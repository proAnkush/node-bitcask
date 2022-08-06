const fs = require("fs");
const path = require("path");

const constants = require("../constants.json");

const utils = require("../utils/utils");
// todo store data to disk after a certain period. till then maintain it in memory
// todo create a variable that will keep count of unreferenced/garabage bytes in the file
// 
class NodeBitcask {
  constructor() {
    this.dataDir = path.join(__dirname, "..", "data");
    this.logfilename = "logfile.bin";
    this.kvSnapshotDir = "./src/kvSnapshot.bin";
    this.kvStore = {};
    this.tombstones = [];
    this.seek = 0;
    this.unreferencedBytesCount = 0;
    this.isCompactionInProgress = false;
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
    }, constants.backupKVInterval);
    setInterval(() => {
      if(this.isCompactionInProgress || this.unreferencedBytesCount < 100){
        return;
      }else{
        this.isCompactionInProgress = true;
        this.isCompactionInProgress = this.compaction(JSON.parse(JSON.stringify(this.kvStore)))
      }
    }, constants.compactionInterval);
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
      if(this.kvStore[key]){
        this.unreferencedBytesCount += this.kvStore[key].totalBytes
      }
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
      this.kvStore[key].deleted = true
      this.unreferencedBytesCount += this.kvStore[key].totalBytes
    }
  }

  compaction(tmpKVStore){
    // either copy only those whose key exists, or delete the existing ones?
    if(!tmpKVStore){
      this.isCompactionInProgress = false;
      return false;
    }
    // create tmp file
    fs.writeFile(
      path.join(__dirname, "..", "data", "tmpLog.bin"),
      "",
      (err) => {
        if (err) {
          console.error(err);
          return false;
        }
        try {
          let writerStream = fs.createWriteStream(
            path.join(__dirname, "..", "data", "tmpLog.bin")
          );
          let tmpSeek = 0;

          for (let key of Object.keys(tmpKVStore)) {
            if (tmpKVStore[key].deleted == true) {
              tmpKVStore[key] = undefined;
            } else {
              utils.getStoredContent(
                path.join(this.dataDir, this.logfilename),
                tmpKVStore[key].address,
                tmpKVStore[key].totalBytes,
                (content) => {
                  if (!content) {
                    throw Error("cannot read ", key);
                  }
                  console.log("Wrote, ", content);
                  writerStream.write(content);
                  tmpKVStore[key].address = tmpSeek;
                  tmpSeek += tmpKVStore[key].totalBytes;
                  tmpKVStore[key].shed = true
                }
              );
            }
          }
          writerStream.on("close", () => {
            // all the writing has finished,
            this.seek = tmpSeek;
            this.kvStore = tmpKVStore;
            this.unreferencedBytesCount = 0;
            
            fs.copyFileSync(
              path.join(
                (__dirname, "..", "data", "tmpLog.bin"),
                path.join(path.join(this.dataDir, this.logfilename))
              )
            );
            fs.unlink(path.join(__dirname, "..", "data", "tmpLog.bin"), (err) => {
              if(err){
                console.error(err);
              }
            });
            return false;
          });
        } catch (error) {
          console.log(error);
          return false;
        }
      }
    );

  }

}

module.exports = NodeBitcask;
