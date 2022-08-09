const fs = require("fs");
const path = require("path");

const constants = require("../constants.json");

const utils = require("../utils/utils");
// todo getPromises
class NodeBitcask {
  #dataDir;
  #logfilename;
  #kvSnapshotDir;
  #compactionInterval;
  #backupKVInterval;
  #kvStore;
  #tombstones;
  #seek;
  #unreferencedBytesCount;
  #isCompactionInProgress;
  #backupKVSetInterval;
  #compactionSetInterval;
  constructor() {
    // instance variables
    this.#dataDir = path.join(__dirname);
    this.#logfilename = "logfile.bin";
    this.#kvSnapshotDir = path.join(__dirname, "kvSnapshot.bin");
    this.#compactionInterval = constants.compactionInterval;
    this.#backupKVInterval = constants.backupKVInterval;
    this.#kvStore = {};
    this.#tombstones = [];
    this.#seek = 0;
    this.#unreferencedBytesCount = 0;
    this.#isCompactionInProgress = false;

    this.#backupKVInterval = setInterval(() => {
      utils.createKVSnapshot(this.#kvSnapshotDir, this.#kvStore);
    }, this.#backupKVInterval);
    [this.#seek, this.#kvStore] = utils.readKVSnapshot(
      this.#kvSnapshotDir,
      path.join(this.#dataDir, this.#logfilename)
    );
    try {
      fs.mkdirSync(this.#dataDir);
      fs.writeFileSync(path.join(this.#dataDir, this.#logfilename), "");
    } catch {
      // error because dir exists
    }
    this.#compactionSetInterval = setTimeout(() => {
      this.#compaction(JSON.parse(JSON.stringify(this.#kvStore)));
    }, this.#compactionInterval);
  }

  /**
   *
   * @param {String} key
   * @param {function} cb
   * finds the data corresponding to the `key` and passes down the data to `cb`
   */
  get(key, cb) {
    utils.validateKey(key, this.#kvStore);
    if (this.#kvStore[key] == undefined) {
      cb(null);
      return null;
    }
    let address = this.#kvStore[key].address;
    let totalBytes = this.#kvStore[key].totalBytes;
    // console.log(this.#kvStore);
    utils.getStoredContent(
      path.join(this.#dataDir, this.#logfilename),
      address,
      totalBytes,
      (data) => {
        // console.log(data);
        if (!data) {
          cb(null);
          console.log("No data");
        } else {
          try {
            if (!utils.checkHash(this.#kvStore[key].checkSum, data)) {
              cb(null);
              return;
            }
            if (data) {
              cb(
                data.substring(
                  String(key).length +
                    constants.keySeparatorLength +
                    constants.messagePaddingLLength,
                  totalBytes - 1
                )
              );
            }
          } catch (error) {
            if (error) {
              console.log(error);
              cb(null);
              return;
            }
          }
        }
      }
    );
  }

  /**
   *
   * @param {[String]} key
   * @param {[String]} message
   * log stores the `key` to a json object and the `message` object out of memory for efficient speed and memory optimisation
   */
  log(key, message) {
    if (!this.#kvStore) {
      this.#kvStore = {};
    }
    if (!this.#seek) {
      this.#seek = 0;
    }
    let isMessageValid = utils.validateMessage(message);
    let isKeyValid = utils.validateKey(key, this.#kvStore);
    if (isKeyValid && isMessageValid) {
      let data = key + "," + JSON.stringify({ bin: message });
      if (this.#kvStore && this.#kvStore[key]) {
        this.#unreferencedBytesCount += this.#kvStore[key].totalBytes;
      }
      let messageHash = utils.getHash(data);
      this.#kvStore[key] = {
        checkSum: messageHash,
        totalBytes: data.length,
        address: this.#seek,
      };
      this.#seek += data.length;
      fs.appendFileSync(path.join(this.#dataDir, this.#logfilename), data);
    }
  }

  /**
   * Empties the database files and unlinks the kv object,
   *  warning: some operations might still be pending, this will affect their output.
   */
  unload() {
    try {
      utils.empty(path.join(this.#dataDir, this.#logfilename));
      utils.empty(this.#kvSnapshotDir);
      this.#kvStore = {};
      this.#seek = {};
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

  getSync() {
    console.log("not yet defined");
  }
  putSync() {
    console.log("not yet defined");
  }

  /**
   *
   * @param {import("fs").PathLike} newLogFileDir
   * @param {import("fs").PathLike} newKVFileDir
   * Synchronously exports the KV store to `newKVFileDir` and the disk data for corresponding keys to `newLogFileDir`
   */
  exportDataSync(newLogFileDir, newKVFileDir) {
    fs.mkdirSync(newLogFileDir, { recursive: true });
    fs.mkdirSync(newKVFileDir, { recursive: true });
    fs.copyFileSync(path.join(this.#dataDir, this.#logfilename), newLogFileDir);
    fs.copyFileSync(this.#kvSnapshotDir, newKVFileDir);
  }

  /**
   *
   * @param {import("fs").PathLike} logFilePath
   * @param {import("fs").PathLike} KVFilePath
   * `logFilePath` is path to the huge disk data, and `KVFilePath` contains the in memory kv store.
   * From both of these files, the database can be reconstructed Synchronously.
   */
  importDataSync(logFilePath, KVFilePath) {
    try {
      fs.copyFileSync(logFilePath, path.join(this.#dataDir, this.#logfilename));
      fs.copyFileSync(KVFilePath, this.#kvSnapshotDir);
      [this.#seek, this.#kvStore] = utils.readKVSnapshot(
        this.#kvSnapshotDir,
        path.join(this.#dataDir, this.#logfilename)
      );
    } catch (error) {
      if (error) {
        console.error(error);
      }
    }
  }

  /**
   *
   * @param {String} key
   * deletes a key, and its corresponding data
   */
  deleteLog(key) {
    utils.validateKey(key, this.#kvStore);
    if (this.#kvStore[key]) {
      utils.createKVSnapshot(this.#kvSnapshotDir, this.#kvStore);
      this.#tombstones.push({
        start: this.#kvStore[key].address,
        length: this.#kvStore[key].totalBytes,
      });
      this.#kvStore[key].deleted = true;
      this.#unreferencedBytesCount += this.#kvStore[key].totalBytes;
    }
  }

  /**
   *
   * @param {{
   *  dataDir: import("fs").PathLike,
   *  kvSnapshotDir: import("fs").PathLike,
   *  backupKVInterval: interval in ms,
   *  compactionInterval: interval in ms
   * }} configJSON
   */
  configure(configJSON) {
    if (!configJSON || typeof configJSON != "object") {
      return false;
    }
    if (configJSON.dataDir) {
      this.#dataDir = configJSON.dataDir;
    }
    if (configJSON.kvSnapshotPath) {
      this.#kvSnapshotDir = configJSON.kvSnapshotPath;
    }
    if (configJSON.backupKVInterval) {
      this.#backupKVInterval = configJSON.backupKVInterval;
      clearInterval(this.#backupKVSetInterval);
      this.#backupKVInterval = setInterval(() => {
        utils.createKVSnapshot(this.#kvSnapshotDir, this.#kvStore);
      }, this.#backupKVInterval);
    }
    if (configJSON.compactionInterval) {
      this.#compactionInterval = configJSON.compactionInterval;
      clearInterval(this.#compactionSetInterval);
      this.#compactionSetInterval = setTimeout(() => {
        this.#compaction(JSON.parse(JSON.stringify(this.#kvStore)));
      }, this.#compactionInterval);
    }
  }

  /**
   *
   * @param {Object} tmpKVStore
   * de-fragments the unreferenced data, and frees up disk.
   */
  #compaction(tmpKVStore) {
    // either copy only those whose key exists, or delete the existing ones?
    // if (this.#isCompactionInProgress || this.#unreferencedBytesCount < 100) {
    //   return;
    // } else {
    //   this.#isCompactionInProgress = true;
    // }
    if (!tmpKVStore) {
      this.#isCompactionInProgress = false;
      return false;
    }

    let tmpLogPath = path.join(__dirname, "..", "tmpLog.bin");
    // create tmp file
    fs.writeFile(tmpLogPath, "", (err) => {
      if (err) {
        console.error(err);
        this.#isCompactionInProgress = false;
        return false;
      }
      try {
        let writerStream = fs.createWriteStream(tmpLogPath);
        let tmpSeek = 0;

        for (let key of Object.keys(tmpKVStore)) {
          if (tmpKVStore[key].deleted == true) {
            tmpKVStore[key] = undefined;
          } else {
            utils.getStoredContent(
              path.join(this.#dataDir, this.#logfilename),
              tmpKVStore[key].address,
              tmpKVStore[key].totalBytes,
              (content) => {
                if (!content) {
                  throw Error("cannot read ", key);
                }
                writerStream.write(content, (err) => {
                  if (err) {
                    console.error(err);
                  }
                });
                tmpKVStore[key].address = tmpSeek;
                tmpSeek += tmpKVStore[key].totalBytes;
              }
            );
          }
        }
        writerStream.end();
        writerStream.on("end", () => {
          // all the writing has finished,
          this.#seek = tmpSeek;
          this.#kvStore = tmpKVStore;
          this.#unreferencedBytesCount = 0;
          fs.copyFileSync(
            tmpLogPath,
            path.join(this.#dataDir, this.#logfilename)
          );

          fs.unlink(tmpLogPath, (err) => {
            if (err) {
              console.error(err);
            }
          });
          this.#isCompactionInProgress = false;
          return false;
        });
      } catch (error) {
        console.error(error);
        this.#isCompactionInProgress = false;
        return false;
      }
    });
  }
}

module.exports = NodeBitcask;
