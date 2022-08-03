"use strict"

const NodeBitcask = require("./src/node-bitcask")
const myNodeBitcask = new NodeBitcask({dataDir: "./data"});
myNodeBitcask.log("key", "message"); //7
myNodeBitcask.get("key");
myNodeBitcask.log("key2", "keto kya"); //8
myNodeBitcask.get("key2");
myNodeBitcask.log("key2", "ke3 kya"); //7
myNodeBitcask.get("key2");
// myNodeBitcask.unload()

// myNodeBitcask.createKVSnapshot();
// myNodeBitcask.readKVSnapshot()
// myNodeBitcask.unload();

module.exports = NodeBitcask


