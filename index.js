"use strict";
const NodeBitcask = require("./src/node-bitcask");
const myNodeBitcask = new NodeBitcask();
myNodeBitcask.log("Test", "BIG VALUE");
myNodeBitcask.get("Test", console.log);
myNodeBitcask.log("horse", "not a zebra");
myNodeBitcask.log("duck", "Moneh moneh moneh moneh");
myNodeBitcask.get("horse", console.log)
myNodeBitcask.get("duck", console.log);
myNodeBitcask.get("zebra", console.log)
module.exports = myNodeBitcask;

// const crypto = require("crypto");
// let s = "{\"bin\": \"message\"}";
// let hash = crypto.createHash('md5').update(s).digest("hex");
// console.log(hash);
// let hash2 = crypto.createHash('md5').update(s).digest("hex");
// console.log(hash2);
// console.log(hash == hash2);
