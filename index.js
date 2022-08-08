"use strict";
const NodeBitcask = require("./src/node-bitcask");
const myNodeBitcask = new NodeBitcask();
myNodeBitcask.log("Test", "BIG VALUE");
myNodeBitcask.get("Test", console.log);
module.exports = myNodeBitcask;
