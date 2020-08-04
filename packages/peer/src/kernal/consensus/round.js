/**
 * Round
 * wangxm   2018-01-07
 */
import { bignum } from '@ddn/utils'

import RoundChanges from './round-changes'

let _singleton

class Round {
  static singleton (context) {
    if (!_singleton) {
      _singleton = new Round(context)
    }
    return _singleton
  }

  constructor (context) {
    Object.assign(this, context)
    this._context = context

    this._feesByRound = {}
    this._rewardsByRound = {}
    this._delegatesByRound = {}
    this._unDelegatesByRound = {}
  }

  async prepare () {
    const round = await this.calc(this.runtime.block.getLastBlock().height)
    const roundStr = round.toString()

    await new Promise((resolve, reject) => {
      this.dao.findOne('block', {
        [roundStr]: this.dao.db_str(`(select (cast(block.height / ${this.constants.delegates} as integer) + (case when block.height % ${this.constants.delegates} > 0 then 1 else 0 end))) = ${roundStr}`)
      }, [
        [this.dao.db_fnSum(''), 'fees'], // wxm block database    library.dao.db_fn('sum', library.dao.db_col('totalFee'))
        [this.dao.db_fnGroupConcat('reward'), 'rewards'], // wxm block database   library.dao.db_fn('group_concat', library.dao.db_col('reward'))
        [this.dao.db_fnGroupConcat('generator_public_key'), 'delegates'] // wxm block database   library.dao.db_fn('group_concat', library.dao.db_col('generatorPublicKey'))
      ], (_err, row) => {
        if (!row) {
          row = {
            fees: '',
            rewards: [],
            delegates: []
          }
        }

        this._feesByRound[round] = row.fees
        this._rewardsByRound[round] = row.rewards.length > 0 ? row.rewards.split(',') : []
        this._delegatesByRound[round] = row.delegates.length ? row.delegates.split(',') : []

        resolve()
      })
    })
  }

  async calc (height) {
    let value = 0
    if (bignum.isGreaterThan(bignum.modulo(height, this.constants.superPeers), 0)) {
      value = 1
    }
    return bignum.plus(bignum.floor(bignum.divide(height, this.constants.superPeers)), value)
  }

  async getVotes (round, dbTrans) {
    // shuai 2018-11-24
    return new Promise((resolve, reject) => {
      try {
        this.dao.findListByGroup('mem_round', { round: round.toString() }, {
          group: ['delegate', 'round'],
          attributes: ['delegate', 'round', [this.dao.db_fnSum('amount'), 'amount']] // wxm block database library.dao.db_fn('sum', library.dao.db_col('amount'))
        }, dbTrans, (err, data) => {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  async flush (round, dbTrans) {
    return new Promise((resolve, reject) => {
      // shuai 2018-11-21
      this.dao.remove('mem_round', { round: round.toString() }, dbTrans, (err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      })
    })
  }

  async directionSwap (direction, lastBlock) {
    // wxm TODO
  }

  async tick (block, dbTrans) {
    await this.runtime.account.merge(null, {
      publicKey: block.generator_public_key, // wxm block database
      producedblocks: 1,
      block_id: block.id, // wxm block database
      round: await this.calc(block.height)
    }, dbTrans)

    const round = await this.calc(block.height)

    this._feesByRound[round] = (this._feesByRound[round] || 0)

    this._feesByRound[round] = bignum.plus(this._feesByRound[round], block.total_fee) // wxm block database

    this._rewardsByRound[round] = (this._rewardsByRound[round] || [])
    this._rewardsByRound[round].push(block.reward)

    this._delegatesByRound[round] = this._delegatesByRound[round] || []
    this._delegatesByRound[round].push(block.generator_public_key)

    const nextRound = await this.calc(bignum.plus(block.height, 1))

    if (bignum.isEqualTo(round, nextRound) && !bignum.isEqualTo(block.height, 1)) {
      this.logger.debug('Round tick completed', {
        height: block.height
      })
      return
    }

    if (this._delegatesByRound[round].length !== this.constants.delegates &&
            !bignum.isEqualTo(block.height, 1) && !bignum.isEqualTo(block.height, this.constants.delegates)) {
      this.logger.debug('Round tick completed', {
        height: block.height
      })
      return
    }

    const outsiders = []

    if (!bignum.isEqualTo(block.height, 1)) {
      const roundDelegates = await this.runtime.delegate.getDisorderDelegatePublicKeys(block.height)

      for (let i = 0; i < roundDelegates.length; i++) {
        if (!this._delegatesByRound[round].includes(roundDelegates[i])) {
          outsiders.push(this.runtime.account.generateAddressByPublicKey(roundDelegates[i]))
        }
      }
    }

    if (outsiders.length) {
      const escaped = outsiders.map(item => `'${item}'`)
      await this.runtime.account.updateAccount({
        missedblocks: this.dao.db_str('missedblocks + 1')
      }, { address: escaped.join(',') }, dbTrans)
    }

    const roundChanges = new RoundChanges(this._context, round)
    for (let index = 0; index < this._delegatesByRound[round].length; index++) {
      const delegate = this._delegatesByRound[round][index]

      const changes = roundChanges.at(index)
      let changeBalance = changes.balance
      let changeFees = changes.fees
      const changeRewards = changes.rewards
      if (index === this._delegatesByRound[round].length - 1) {
        changeBalance = bignum.plus(changeBalance, changes.feesRemaining)
        changeFees = bignum.plus(changeFees, changes.feesRemaining)
      }

      await this.runtime.account.merge(null, {
        publicKey: delegate, // wxm block database
        balance: changeBalance.toString(),
        u_balance: changeBalance.toString(),
        block_id: block.id, // wxm block database
        round: await this.calc(block.height),
        fees: changeFees.toString(),
        rewards: changeRewards.toString()
      }, dbTrans)
    }

    // distribute club bonus
    const bonus = new RoundChanges(this._context, round).getClubBonus()
    const fees = bonus.fees
    const rewards = bonus.rewards

    this.logger.info(`DDN witness club get new bonus: ${JSON.stringify(bonus)}`)

    await this.runtime.account.merge(this.constants.foundAddress, {
      address: this.constants.foundAddress,
      balance: bignum.plus(fees, rewards).toString(),
      u_balance: bignum.plus(fees, rewards).toString(),
      fees: fees.toString(),
      rewards: rewards.toString(),
      block_id: block.id, // wxm block database
      round: await this.calc(block.height)
    }, dbTrans)

    const votes = await this.getVotes(round, dbTrans)
    for (let i = 0; i < votes.length; i++) {
      const vote = votes[i]
      const address = this.runtime.account.generateAddressByPublicKey(vote.delegate)
      await this.runtime.account.updateAccount({
        vote: this.dao.db_str(`vote + ${vote.amount}`)
      }, { address }, dbTrans)
    }

    if (this.runtime.socketio) {
      setImmediate(async () => {
        try {
          await this.runtime.socketio.emit('rounds/change', { number: round })
        } catch (err) {
          this.logger.error(`The socket emit error: rounds/change. ${err}`)
        }
      })
    }

    await this.flush(round, dbTrans)

    delete this._feesByRound[round]
    delete this._rewardsByRound[round]
    delete this._delegatesByRound[round]

    this.logger.debug('Round tick completed', {
      height: block.height
    })
  }

  async backwardTick (block, previousBlock, dbTrans) {
    const done = (err) => {
      if (err) {
        this.logger.error(`Round backward tick failed: ${err}`)
      } else {
        this.logger.debug('Round backward tick completed', {
          block,
          previousBlock
        })
      }
    }

    await this.runtime.account.merge(null, {
      publicKey: block.generator_public_key, // wxm block database
      producedblocks: -1,
      block_id: block.id, // wxm block database
      round: await this.calc(block.height)
    }, dbTrans)

    const round = await this.calc(block.height)
    const prevRound = await this.calc(previousBlock.b_height)

    this._feesByRound[round] = (this._feesByRound[round] || 0)

    this._feesByRound[round] = bignum.minus(this._feesByRound[round], block.totalFee)

    this._rewardsByRound[round] = (this._rewardsByRound[round] || [])
    this._rewardsByRound[round].pop()

    this._delegatesByRound[round] = this._delegatesByRound[round] || []
    this._delegatesByRound[round].pop()

    if (prevRound === round && !bignum.isEqualTo(previousBlock.b_height, 1)) {
      return done()
    }

    // wxm TODO 这块还有问题，也就是_unDelegatesByRound没有任何地方有赋值操作，所以length不会存在，这里待改，暂时改成下面
    this._unDelegatesByRound[round] = this._unDelegatesByRound[round] || []
    this._unDelegatesByRound[round].pop()

    if (this._unDelegatesByRound[round].length !== this.constants.delegates && !bignum.isEqualTo(previousBlock.b_height, 1)) {
      return done()
    }

    this.logger.warn('Unexpected roll back cross round', {
      round,
      prevRound,
      block,
      previousBlock
    })
    process.exit(1)

    // wxm TODO 下面的代码本来没有注释，但上面直接exit了，不会走到这里，所以整个方法的逻辑还需要梳理
    // FIXME process the cross round rollback
    // const outsiders = [];
    // async.series([
    //   cb => {
    //     //bignum update if (block.height === 1) {
    //     if (bignum.isEqualTo(block.height, 1)) {
    //       return cb();
    //     }
    //     modules.delegates.generateDelegateList(block.height, (err, roundDelegates) => {
    //       if (err) {
    //         return cb(err);
    //       }
    //       for (let i = 0; i < roundDelegates.length; i++) {
    //         if (privated.unDelegatesByRound[round].indexOf(roundDelegates[i]) === -1) {
    //           outsiders.push(modules.accounts.generateAddressByPublicKey(roundDelegates[i]));
    //         }
    //       }
    //       cb();
    //     });
    //   },
    //   cb => {
    //     if (!outsiders.length) {
    //       return cb();
    //     }
    //     const escaped = outsiders.map(item => `'${item}'`);
    //     // shuai 2018-11-21
    //     library.dao.update('mem_account', {
    //       missedblocks: Sequelize.literal('missedblocks - 1')
    //     }, { address: { '$in': escaped.join(',') } }, dbTrans, cb)
    //     // library.dbLite.query(`update mem_accounts set missedblocks = missedblocks - 1 where address in (${escaped.join(',')})`, (err, data) => {
    //     //   cb(err);
    //     // });
    //   },
    //   cb => {
    //     const roundChanges = new RoundChanges(round, true);

    //     async.forEachOfSeries(privated.unDelegatesByRound[round], (delegate, index, next) => {
    //       const changes = roundChanges.at(index);
    //       let changeBalance = changes.balance;
    //       let changeFees = changes.fees;
    //       const changeRewards = changes.rewards;

    //       if (index === 0) {
    //         // bignum update
    //         // changeBalance += changes.feesRemaining;
    //         // changeFees += changes.feesRemaining;
    //         changeBalance = bignum.plus(changeBalance, changes.feesRemaining);
    //         changeFees = bignum.plus(changeFees, changes.feesRemaining);
    //       }

    //       modules.accounts.mergeAccountAndGet({
    //         publicKey: delegate,   //wxm block database
    //         balance: bignum.minus(0, changeBalance).toString(),    //bignum update -changeBalance,
    //         u_balance: bignum.minus(0, changeBalance).toString(),  //bignum update -changeBalance,
    //         block_id: block.id,  //wxm block database
    //         round: modules.round.calc(block.height).toString(),
    //         fees: bignum.minus(0, changeFees).toString(),   //bignum update -changeFees,
    //         rewards: bignum.minus(0, changeRewards).toString()  //bignum update -changeRewards
    //       }, dbTrans, next);
    //     }, cb);
    //   },
    //   cb => {
    //     // distribute club bonus
    //     const bonus = new RoundChanges(round).getClubBonus();
    //     const fees = bonus.fees;
    //     const rewards = bonus.rewards;

    //     const BONUS_CURRENCY = this.constants.tokenName

    //     library.logger.info(`DDN witness club get new bonus: ${bonus}`)
    //     modules.accounts.mergeAccountAndGet({
    //       address: this.constants.foundAddress,
    //       balance: bignum.minus(0, fees, rewards).toString(),     //bignum update -(fees + rewards),
    //       u_balance: bignum.minus(0, fees, rewards).toString(),       //bignum update -(fees + rewards),
    //       fees: bignum.minus(0, fees).toString(),     //bignum update -fees,
    //       rewards: bignum.minus(0, rewards).toString(),       //bignum update -rewards,
    //       block_id: block.id,    //wxm block database
    //       round: modules.round.calc(block.height).toString(),
    //     }, dbTrans, err => {
    //       cb(err);
    //     });
    //   },
    //   cb => {
    //     self.getVotes(round, (err, votes) => {
    //       if (err) {
    //         return cb(err);
    //       }
    //       async.eachSeries(votes, (vote, cb) => {
    //         let address = null;
    //         address = modules.accounts.generateAddressByPublicKey(vote.delegate)
    //         library.dao.update('mem_account', {
    //           vote: Sequelize.literal('vote + ' + vote.amount),
    //         }, { address }, dbTrans, cb)
    //         // library.dbLite.query('update mem_accounts set vote = vote + $amount where address = $address', {
    //         //   address,
    //         //   amount: vote.amount
    //         // }, cb);
    //       }, err => {
    //         self.flush(round, err2 => {
    //           cb(err || err2);
    //         });
    //       })
    //     });
    //   }
    // ], err => {
    //   delete privated.unFeesByRound[round];
    //   delete privated.unRewardsByRound[round];
    //   delete privated.unDelegatesByRound[round];
    //   done(err)
    // });
  }
}

export default Round
