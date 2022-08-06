const fs = require("fs");
const path = require("path");

const constants = require("../constants.json");

const utils = require("../utils/utils");
// todo store data to disk after a certain period. till then maintain it in memory
class NodeBitcask {
  constructor() {
    this.dataDir = path.join(__dirname, "..", "data");
    this.logfilename = "logfile.bin";
    this.kvSnapshotDir = "./src/kvSnapshot.bin";
    this.kvStore = {};
    this.tombstones = [];
    this.seek = 0;
    // if (config && config.dataDir) {
    //   this.dataDir = config.dataDir;
    // }
    [this.seek, this.kvStore] = utils.readKVSnapshot(
      this.kvSnapshotDir,
      path.join(this.dataDir, this.logfilename)
    );
    try {
      fs.mkdirSync(this.dataDir);
      fs.writeFileSync(path.join(this.dataDir, this.logfilename), "");
    } catch {
      // error because dir exists
    }
    setInterval(() => {
      utils.createKVSnapshot(this.kvSnapshotDir, this.kvStore);
      console.log("storing kv");
    }, constants.backupKVInterval);
    setInterval(() => {
      console.log("compacin");
      this.compaction({...this.kvStore})
    }, 10000);
    // setInterval(() => {
    //   this.processTombstones(
    //     [...this.tombstones],
    //     path.join(this.dataDir, this.logfilename)
    //   );
    //   this.tombstones = []
    // }, constants.processTombstoneInterval);
    // setInterval(() => {
      
    // }, constants.compactionInterval);
  }

  /**
   *
   * @param {String} key
   * @param {function} cb callback which will be called with the output.
   *
   * @returns
   */
  get(key, cb) {
    utils.validateKey(key, this.kvStore);
    if (this.kvStore[key] == undefined) {
      return null;
    }
    let address = this.kvStore[key].address;
    let totalBytes = this.kvStore[key].totalBytes;
    utils.getStoredContent(path.join(this.dataDir, this.logfilename), address, totalBytes, (data) => {
      if(!data){
        cb(null)
      }else{
        cb(JSON.parse(data.substr((String(key).length + 1), totalBytes)).bin)
      }

    })
    // let length =
    //   totalBytes - (String(key).length + constants.keySeparatorLength);
    // let position =
    //   address + (String(key).length + constants.keySeparatorLength);

    // // read to buffer
    // let readToBuffer = Buffer.alloc(length);

    // // go to address in the file and start reading
    // setTimeout(() => {
    //   fs.open(path.join(this.dataDir, this.logfilename), "r", (err, fd) => {
    //     if (err) {
    //       throw err;
    //     }
    //     if (!fd) {
    //       throw Error("invalid fd");
    //     }
    //     try {
    //       fs.read(
    //         fd,
    //         readToBuffer,
    //         0,
    //         length,
    //         position,
    //         (err, bytesRead, buffer) => {
    //           if (err) {
    //             console.error(err);
    //           }
    //           fs.close(fd, utils.handleErrorDefault);
    //           // buffer.slice(String(key).length+1, address+totalBytes-1);
    //           cb(JSON.parse(decodeURIComponent(buffer.toString())).bin);
    //           // .substring((String(key).length)+1, address+totalBytes-1))
    //         }
    //       );
    //     } catch (error) {
    //       if (error) {
    //         console.error(error);
    //         fs.close(fd, utils.handleErrorDefault);
    //         cb(null);
    //       }
    //     }
    //   });
    // }, 0);
  }



  /**
   *
   * @param {[String]} key [a key which can be used as index]
   * @param {[String]} message [a buffer object for the value relating to provided key]
   * @return
   * log stores the key to a json object and the message object out of memory for efficient speed and memory optimisation
   */
  log(key, message) {
    /* stores the log */
    let isMessageValid = utils.validateMessage(message);
    let isKeyValid = utils.validateKey(key, this.kvStore);
    message = JSON.stringify({ bin: message });
    if (isKeyValid && isMessageValid) {
      let data = key + "," + message;
      this.kvStore[key] = {
        address: this.seek,
        totalBytes:
          String(key).length + constants.keySeparatorLength + message.length,
        checksum: null,
      };
      this.seek +=
        message.length + constants.keySeparatorLength + String(key).length;
      fs.appendFileSync(path.join(this.dataDir, this.logfilename), data);

      // store as plain text
    }
  }

  /**
   * Empties the database files and unlinks the kv object,
   *  warning: some operations might still be pending, this will affect their output.
   */
  unload() {
    try {
      utils.empty(path.join(this.dataDir, this.logfilename));
      utils.empty(this.kvSnapshotDir);
      this.kvStore = {};
      this.seek = {};
    } catch (error) {
      if (error) throw error;
    }
  }
  put(key, message) {
    return this.log(key, message);
  }
  getLog(key, cb) {
    return this.get(key, cb);
  }
  putLogStream(key, messageStream) {
    // get chunks from stream, and put them to file, increment totalbytes and write data in contiguous sequence
  }
  getLogStream(key, cb) {
    // if total bytes is BIG, then do cb with stream of data
  }
  getSync() {
    console.log("not yet defined");
  }
  putSync() {
    console.log("not yet defined");
  }

  exportDataSync(newLogFileDir, newKVFileDir) {
    fs.mkdirSync(newLogFileDir, { recursive: true });
    fs.mkdirSync(newKVFileDir, { recursive: true });
    fs.copyFileSync(path.join(this.dataDir, this.logfilename), newLogFileDir);
    fs.copyFileSync(this.kvSnapshotDir, newKVFileDir);
  }

  importDataSync(logFilePath, KVFilePath) {
    try {
      fs.copyFileSync(logFilePath, path.join(this.dataDir, this.logfilename));
      fs.copyFileSync(KVFilePath, this.kvSnapshotDir);
      [this.seek, this.kvStore] = utils.readKVSnapshot(
        this.kvSnapshotDir,
        path.join(this.dataDir, this.logfilename)
      );
    } catch (error) {
      if (error) {
        console.error(error);
      }
    }
  }
  deleteLog(key) {
    utils.validateKey(key, this.kvStore);
    if (this.kvStore[key]) {
      utils.createKVSnapshot(this.kvSnapshotDir, this.kvStore);
      this.tombstones.push({start: this.kvStore[key].address, length: this.kvStore[key].totalBytes})
      // this.kvStore[key] = undefined
      this.kvStore[key].deleted = true
    }
  }

  compaction(tmpKVStore){
    // either copy only those whose key exists, or delete the existing ones?
    fs.writeFile(path.join(__dirname, "..","data","tmpLog.bin"), "", (err) => {
      if(err){
        console.log("cannot open");
        throw err
      }
      try {
        let writerStream = fs.createWriteStream(
          path.join(__dirname, "..", "data", "tmpLog.bin")
        );
        let tmpSeek = 0;
        //  iterate over aall keys
          // get the data from actual log file for this key
          // store the key to tmpKVStore, and the data to tmpLog
          // !note if some keys are marked deleted during compaction, those will be taken care of in the next interval
          // after compaction, update actual log and tmplog
          // ? remeber to handle newly added logs

        for(let key of Object.keys(tmpKVStore)){
          if(tmpKVStore[key].deleted == true){
            tmpKVStore[key] = undefined;
          }else{
            utils.getStoredContent(path.join(this.dataDir, this.logfilename), tmpKVStore[key].address, tmpKVStore[key].totalBytes, (content) => {
              if(!content){
                throw Error("cannot read ", key)
              }
              console.log("Wrote, ", content);
              writerStream.write(content);
              tmpKVStore[key].address = tmpSeek;
              tmpSeek += tmpKVStore[key].totalBytes;
            })
          }
          // this.KVStore = tmpKVStore;
          // fs.copy tmplog to logfilepath
        }
        // console.log(tmpKVStore);
        // console.log(this.kvStore);
        writerStream.on("close", () => console.log("closed"))
        
      } catch (error) {
        console.log(error);
      }
    })

  }

}

module.exports = NodeBitcask;
