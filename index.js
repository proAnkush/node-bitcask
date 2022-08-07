"use strict"
const path = require("path");
const fs = require("fs");
const NodeBitcask = require("./src/node-bitcask");
const myNodeBitcask = new NodeBitcask({ dataDir: "./data" });
// myNodeBitcask.log("key", "message"); //7
// myNodeBitcask.get("key", (data) => {
//   if (data == null) console.log("nil");
//   console.log(data);
// }); // message
// myNodeBitcask.log("key2", "keto kya"); //8
// myNodeBitcask.get("key2", console.log); // keto kya
// myNodeBitcask.log("key2", "ke3 kya"); //7
// myNodeBitcask.get("key2", console.log); // ke3 kya

// myNodeBitcask.get("key2", console.log); // ke3 kya
// myNodeBitcask.log("key2", "keto4 kya"); //8
// // myNodeBitcask.log("keyBuf", Buffer.from("ABC123")); //8
// myNodeBitcask.get("key2", console.log); // keto4 kya
// setTimeout(() => {
//   myNodeBitcask.get("key2", console.log); // keto4kya
// }, 1000);
// fs.mkdir(path.join(__dirname, "database"), (err) => console.error(err));
// myNodeBitcask.exportDataSync(
//   path.join(__dirname, "database"),
//   path.join(__dirname, "database")
// );
myNodeBitcask.importDataSync(path.join(__dirname, "database", "log.bin"), path.join(__dirname, "database", "kv.bin"));
// myNodeBitcask.deleteLog("key");
setTimeout(() => {
  myNodeBitcask.get("key2", console.log); // keto4 kya
}, 2000);
myNodeBitcask.getStream("key2", (fr) => {
  console.log("test");
  console.log(fr);
  fr.on("data", (chunk) => {
    console.log(decodeURIComponent(chunk.toString()));
  });
});
let readStream = fs.createReadStream(path.join(__dirname, "abc.bin"), {
  highWaterMark: 1024,
});
readStream.on("open", () => {
  console.log(readStream);

  myNodeBitcask.putStream("key3", readStream);
});
setTimeout(() => {
  // myNodeBitcask.getStream("key3", (fr) => {
  //   console.log("tesst3");
  //   fr.on("data", (chunk) => {
  //     console.log(decodeURIComponent(chunk.toString()));
  //   });
  // });
  myNodeBitcask.get("key3", console.log);
}, 3000);
// setTimeout(() => {
//   myNodeBitcask.unload()
// }, 1000);
// myNodeBitcask.unload()

// myNodeBitcask.createKVSnapshot();
// myNodeBitcask.readKVSnapshot()

exports.get = myNodeBitcask.get;
exports.log = myNodeBitcask.log;
exports.put = myNodeBitcask.put;
exports.putStream = myNodeBitcask.putStream;
exports.getStream = myNodeBitcask.getStream;
exports.exportDataSync = myNodeBitcask.exportDataSync;
exports.importDataSync = myNodeBitcask.importDataSync;
exports.deleteLog = myNodeBitcask.deleteLog;
exports.configure = myNodeBitcask.configure;

