const DdnJs =require( "./lib").default

let secret="park pact screen wreck walnut outside liberty very rabbit permit sentence text"
// 空账号
const Eaccount = {
  address: 'DGJepzhD9FkjhQVmyVTphwJAYn7HuqRdJc',
  publicKey: '155a780f875a3c384c1a0856e36b2de7e145a9738e72f9a75a85d26a16471757',
  password: 'park pact screen wreck walnut outside liberty very rabbit permit sentence text'
}
const Daccount = {
  address: 'D8BVJ2MH1wjfJpyXeFHRo2j9Ddbgh6uFcA',
  publicKey: '21363828620b7bc308ac6a0fce494ab8d77065d11d999b6e3af649f01bc2b8e3',
  password: 'nut crater mean palace awful feel mandate winter convince account noise wrestle'
}
// 总账号
const Gaccount = {
  address: 'DC5kJzMdNDhrnupWX2NGafzMoiwdHiySBe',
  password: 'enter boring shaft rent essence foil trick vibrant fabric quote indoor output',
  publicKey: 'daeee33def7eef0c7ba06ec66eda7204437ba88ace8f04e4a6aa4d7bfbd18bc1',
  balance: '10000000000000000'
}
async function mainnet1(){
let supervise={
  txHash:"2b6865011739b3b7e7a564a06609ba3a937cea718f873c0f650bcfe8cac96f34fc8e796da0c0161e911d7c5d6e5c8c9deedfd156beff2438fd185392a1fe4b8f",
  op:"destroy"
}
 let transaction=await DdnJs.supervise.createSupervise(supervise,Eaccount.password)
 console.log(JSON.stringify({transaction}))
}
async function mainnet(){
let supervise={
  txhasn:"",
  op:"destroy"
}
const transaction = await DdnJs.transaction.createTransaction(Daccount.address, 0.01, 'message', Gaccount.password)
 console.log(JSON.stringify({transaction}))
}
mainnet()
mainnet1()