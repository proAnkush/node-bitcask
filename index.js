"use strict"

const NodeBitcask = require("./src/node-bitcask")
const myNodeBitcask = new NodeBitcask({dataDir: "./data"});
// myNodeBitcask.log("key", "message"); //7
// myNodeBitcask.get("key");
// myNodeBitcask.log("key2", "keto kya"); //8
// myNodeBitcask.get("key2");
// myNodeBitcask.log("key2", "ke3 kya"); //7
// myNodeBitcask.get("key2");

myNodeBitcask.get("key", console.log);
myNodeBitcask.log("key2", "keto4 kya"); //8
myNodeBitcask.log("keyBuf", Buffer.from("ABC123")); //8
myNodeBitcask.get("key2", console.log);
setTimeout(() => {
  myNodeBitcask.unload()
}, 1000);
// myNodeBitcask.unload()

// myNodeBitcask.createKVSnapshot();
// myNodeBitcask.readKVSnapshot()

module.exports = NodeBitcask


