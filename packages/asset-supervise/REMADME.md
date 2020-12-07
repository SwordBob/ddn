# 屏蔽违规内容

## 上传屏蔽交易
请求参数说明：

|名称	|类型   |必填 |说明              |   
|------ |-----  |---  |----              |   
|transaction|json|Y|DdnJs.supervise.createSupervise根据txHash(对应交易id）、op:管控指令：destroy（过滤整个内容）、harmless(从滤敏感词转标记为无害)|

返回参数说明：

|名称|类型|说明|
|------|-----|----|
|success|boolean|是否成功获得response数据。|
|transactionId|string|交易id|

   
请求示例：   
```js   
let supervise={
  txHash:"2b6865011739b3b7e7a564a06609ba3a937cea718f873c0f650bcfe8cac96f34fc8e796da0c0161e911d7c5d6e5c8c9deedfd156beff2438fd185392a1fe4b8f",//交易id
  op:"destroy" // 屏蔽类型
}
 let transaction=await DdnJs.supervise.createSupervise(supervise,Eaccount.password)
 console.log(JSON.stringify({transaction}))
}
结果

{"transaction":{"type":90,"nethash":"0ab796cd","amount":"0","fee":"0","recipientId":null,"senderPublicKey":"155a780f875a3c384c1a0856e36b2de7e145a9738e72f9a75a85d26a16471757","timestamp":95972015,"asset":{"supervise":{"txHash":"2b6865011739b3b7e7a564a06609ba3a937cea718f873c0f650bcfe8cac96f34fc8e796da0c0161e911d7c5d6e5c8c9deedfd156beff2438fd185392a1fe4b8f","op":"destroy"}},"signature":"75b46d7d3143d30547151b98307f9b135edef731380dbdebcb685da44e0f274e645153538268172e93e521fe6d4546a786dd7c6860878005238e834d38cdff08","id":"732afc1de17b16b57774b9ea6b98de0a54841fd3ea309f27115adb63a81a690c0b54f3b4f51708f3877d92108571f88b6266ea2b22b2355f8ee6582fdfaa53da"}}

发送交易
curl --location --request POST 'http://localhost:8001/peer/transactions' \
--header 'nethash: 0ab796cd' \
--header 'version: ""' \
--header 'Content-Type: application/json' \
--data-raw '{"transaction":{"type":90,"nethash":"0ab796cd","amount":"0","fee":"0","recipientId":null,"senderPublicKey":"155a780f875a3c384c1a0856e36b2de7e145a9738e72f9a75a85d26a16471757","timestamp":95971335,"asset":{"supervise":{"txHash":"2b6865011739b3b7e7a564a06609ba3a937cea718f873c0f650bcfe8cac96f34fc8e796da0c0161e911d7c5d6e5c8c9deedfd156beff2438fd185392a1fe4b8f","op":"destroy"}},"signature":"c1cae6624a38081d65183e2eb4a2d8ad251456aead1c0ce8840710eb9021960211ec1823fcc5873413696b316f94e149400ca52a2ecec7ff434f7897506a6602","id":"13a9d70bedefac6f9690fac087e5972bd5da2b1d2491a2b7838b2211de5ae84043b49dba9f375c4ff58da025ab201a2890dc839bc73b4eee8e0e0e652759dd96"}}'
```
## 查询屏蔽结果

```bash
curl --location --request GET 'http://localhost:8001/api/transactions/get?id=2b6865011739b3b7e7a564a06609ba3a937cea718f873c0f650bcfe8cac96f34fc8e796da0c0161e911d7c5d6e5c8c9deedfd156beff2438fd185392a1fe4b8f' \
--header 'nethash: 0ab796cd' \
--header 'version: '
```