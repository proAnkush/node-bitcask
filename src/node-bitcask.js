const fs = require("fs");
const path = require("path");

const constants = require("../constants.json");

const utils = require("../utils/utils");
// todo store data to disk after a certain period. till then maintain it in memory
// todo create a variable that will keep count of unreferenced/garabage bytes in the file
// todo getPromises
class NodeBitcask {
  constructor() {
    // instance variables
    this.dataDir = path.join(__dirname, "..", "data");
    this.logfilename = "logfile.bin";
    this.kvSnapshotDir = "./src/kvSnapshot.bin";
    this.compactionInterval = constants.compactionInterval;
    this.backupKVInterval = constants.backupKVInterval;
    this.kvStore = {};
    this.tombstones = [];
    this.seek = 0;
    this.unreferencedBytesCount = 0;
    this.isCompactionInProgress = false;

    setTimeout(() => {
      utils.customUpdatingInterval(
        () => utils.createKVSnapshot(this.kvSnapshotDir, this.kvStore),
        this.backupKVInterval
      );
    }, this.backupKVInterval);
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
    // setInterval(() => {
    //   utils.createKVSnapshot(this.kvSnapshotDir, this.kvStore);
    // }, constants.backupKVInterval);
    // setInterval(() => {
    //   if (this.isCompactionInProgress || this.unreferencedBytesCount < 100) {
    //     return;
    //   } else {
    //     this.isCompactionInProgress = true;
    //     this.isCompactionInProgress = this.compaction(
    //       JSON.parse(JSON.stringify(this.kvStore))
    //     );
    //   }
    // }, constants.compactionInterval);
    setTimeout(() => {
      // if (this.isCompactionInProgress || this.unreferencedBytesCount < 100) {
      //   return;
      // } else {
      utils.customUpdatingInterval(() => {
        this.compaction(JSON.parse(JSON.stringify(this.kvStore))),
          this.compactionInterval;
      });
      // }
    }, this.compactionInterval);
  }

  /**
   *
   * @param {String} key
   * @param {function} cb
   * finds the data corresponding to the `key` and passes down the data to `cb`
   */
  get(key, cb) {
    utils.validateKey(key, this.kvStore);
    if (this.kvStore[key] == undefined) {
      return null;
    }
    let address = this.kvStore[key].address;
    let totalBytes = this.kvStore[key].totalBytes;
    if (totalBytes > 1000000 && totalBytes <= 1000000) {
      console.warn(
        "data is around 1 Mb, prefer to use getStream(key, cb) for big data"
      );
    }
    if (totalBytes > 1000000 * 100) {
      console.error(
        "data is bigger than 100Mb, please use getStream(key, cb), aborting"
      );
      return;
    }
    utils.getStoredContent(
      path.join(this.dataDir, this.logfilename),
      address,
      totalBytes,
      (data) => {
        if (!data) {
          cb(null);
        } else {
          try {
            let parsedJSON = JSON.parse(
              data.substr(String(key).length + 1, totalBytes)
            );
            cb(parsedJSON.bin);
          } catch (error) {
            if (error) {
              cb(
                data.substr(
                  String(key).length + 1 + constants.messagePaddingLLength,
                  totalBytes -
                    (String(key).length + constants.messagePaddingRLength)
                )
              );
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
    /* stores the log */
    let isMessageValid = utils.validateMessage(message);
    let isKeyValid = utils.validateKey(key, this.kvStore);
    message = JSON.stringify({ bin: message });
    if (isKeyValid && isMessageValid) {
      let data = key + "," + message;
      if (this.kvStore[key]) {
        this.unreferencedBytesCount += this.kvStore[key].totalBytes;
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

  /**
   *
   * @param {String} key
   * @param {ReadableStream} messageStream
   * `messageStream` will be used to write the data corresponding to the `key`
   */
  putStream(key, messageStream) {
    // get chunks from stream, and put them to file, increment totalbytes and write data in contiguous sequence
    // write keyName, json padding , content and then json end padding
    let isKeyValid = utils.validateKey(key, this.kvStore);
    let fw = fs.createWriteStream(path.join(this.dataDir, this.logfilename), {
      flags: "a",
    });
    this.kvStore[key] = {
      address: this.seek,
      checksum: null,
    };
    let len = 0;
    let startPadding = `,{"bin":"`;
    let endPadding = `"}`;
    let chunkCount = 0;
    fw.on("open", () => {
      fw.write(key + startPadding);
      len += String(key).length;
      len += startPadding.length;
      messageStream.on("data", (chunk) => {
        chunkCount++;
        len += decodeURIComponent(chunk.toString()).length;
        fw.write(decodeURIComponent(chunk.toString()));
      });
      messageStream.on("close", (err) => {
        console.log("CHUNK", chunkCount);
        fw.write(endPadding);
        len += endPadding.length;
        this.seek += len;
        this.kvStore[key].totalBytes = len;
        // console.log(len, startPadding, endPadding, messageStream);
      });
    });
  }

  /**
   *
   * @param {String} key
   * @param {function} cb
   * finds data for given `key`, which will then be passed down to `cb` as a `ReadStream` object.
   */
  getStream(key, cb) {
    // if total bytes is BIG, then do cb with stream of data
    utils.validateKey(key, this.kvStore);
    if (this.kvStore[key] == undefined) {
      return null;
    }
    let address = this.kvStore[key].address;
    let totalBytes = this.kvStore[key].totalBytes;
    if (totalBytes < 1000000) {
      console.warn(
        "data is less than 1 Mb, prefer to use get(key, cb) for small data"
      );
    }
    let start =
      address +
      String(key).length +
      constants.keySeparatorLength +
      constants.messagePaddingLLength;
    let end = address + totalBytes - constants.messagePaddingRLength;
    let fr = fs.createReadStream(path.join(this.dataDir, this.logfilename), {
      start: start,
      end: end - 1,
    });
    fr.on("open", () => {
      cb(fr);
    });
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
    fs.copyFileSync(path.join(this.dataDir, this.logfilename), newLogFileDir);
    fs.copyFileSync(this.kvSnapshotDir, newKVFileDir);
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

  /**
   *
   * @param {String} key
   * deletes a key, and its corresponding data
   */
  deleteLog(key) {
    utils.validateKey(key, this.kvStore);
    if (this.kvStore[key]) {
      utils.createKVSnapshot(this.kvSnapshotDir, this.kvStore);
      this.tombstones.push({
        start: this.kvStore[key].address,
        length: this.kvStore[key].totalBytes,
      });
      this.kvStore[key].deleted = true;
      this.unreferencedBytesCount += this.kvStore[key].totalBytes;
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
      this.dataDir = configJSON.dataDir;
    }
    if (configJSON.kvSnapshotPath) {
      this.kvSnapshotDir = configJSON.kvSnapshotPath;
    }
    if (configJSON.backupKVInterval) {
      this.backupKVInterval = configJSON.backupKVInterval;
    }
    if (configJSON.compactionInterval) {
      this.compactionInterval = configJSON.compactionInterval;
    }
  }

  /**
   *
   * @param {Object} tmpKVStore
   * de-fragments the unreferenced data, and frees up disk.
   */
  compaction(tmpKVStore) {
    // either copy only those whose key exists, or delete the existing ones?
    if (this.isCompactionInProgress || this.unreferencedBytesCount < 100) {
      return;
    } else {
      this.isCompactionInProgress = true;
    }
    if (!tmpKVStore) {
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
          this.isCompactionInProgress = false;
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
                  writerStream.write(content);
                  tmpKVStore[key].address = tmpSeek;
                  tmpSeek += tmpKVStore[key].totalBytes;
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
            fs.unlink(
              path.join(__dirname, "..", "data", "tmpLog.bin"),
              (err) => {
                if (err) {
                  console.error(err);
                }
              }
            );
            this.isCompactionInProgress = false;
            return false;
          });
        } catch (error) {
          console.error(error);
          this.isCompactionInProgress = false;
          return false;
        }
      }
    );
  }
}

module.exports = NodeBitcask;
