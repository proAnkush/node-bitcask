# Node-Bitcask
const bitcask = require("node-bitcask")
const bitcaskApp = bitcask({dataDir: "/directory/for/storing/logfiles"})
bitcaskApp.log("key", "log briefing and essential information in plain text") => promise({message: "success"});
bitcaskApp.logSync("key", "store a log synchronously") => {message: "success"}
bitcaskApp.getLog("key") => promise({message: "success", data: "get log for provided key"})
