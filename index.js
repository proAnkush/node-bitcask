"use strict";
const NodeBitcask = require("./src/node-bitcask");
const myNodeBitcask = new NodeBitcask();
myNodeBitcask.log("Test", "BIG VALUE");
myNodeBitcask.get("Test", console.log);
myNodeBitcask.log("horse", "not a zebra");
myNodeBitcask.log("duck", "Moneh moneh moneh moneh");
myNodeBitcask.log("zebra", "zebra crossing new forza horizon");
myNodeBitcask.get("horse", console.log);
myNodeBitcask.get("duck", console.log);
myNodeBitcask.get("Test", console.log);
myNodeBitcask.get("zebra", console.log);

module.exports = myNodeBitcask;

// const crypto = require("crypto");
// let s = `zebra,{"bin":"an African wild animal that looks like a horse, with black or brown and white lines on its body"}`;
// let hash = crypto.createHash("md5").update(s).digest("hex");
// console.log(hash);
// let hash2 = crypto.createHash("md5").update(s).digest("hex");
// console.log(hash2);
// console.log(hash == hash2);
