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
  #seek;
  #unreferencedBytesCount;
  #isCompactionInProgress;
  #backupKVSetInterval;
  #compactionSetInterval;
  #pendingData;
  // #activeKeyCount;
  constructor() {
    // instance variables
    this.#dataDir = path.join(__dirname);
    this.#logfilename = "logfile.bin";
    this.#kvSnapshotDir = path.join(__dirname, "kvSnapshot.bin");
    this.#compactionInterval = constants.compactionInterval;
    this.#backupKVInterval = constants.backupKVInterval;
    this.#kvStore = {};
    this.#seek = 0;
    this.#unreferencedBytesCount = 0;
    this.#isCompactionInProgress = false;
    this.#pendingData = {};

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
    this.#compactionSetInterval = setInterval(() => {
      this.#compaction(JSON.parse(JSON.stringify(this.#kvStore)));
    }, this.#compactionInterval);
  }

  /**
   *
   * @param {String} key
   * @param {function} cb
   * asynchronously finds the data corresponding to the `key` and passes down the data to `cb`
   */
  get(key, cb) {
    if (!cb) {
      console.error(
        "Callback to get cannot be undefined, please provide a function()"
      );
      return;
    }
    utils.validateKey(key, this.#kvStore);
    if (this.#pendingData[key]) {
      cb(this.#pendingData[key]);
      return;
    }
    if (this.#kvStore[key] == undefined) {
      cb(null);
      return null;
    }
    let dataOnMemory = this.#kvStore[key].data;
    if (dataOnMemory != null) {
      cb(dataOnMemory);
      return;
    }
    // if (this.#isCompactionInProgress) {
    //   console.log("setting event");
    //   this.#onCompactionEnd(() => this.get(key, cb));
    //   return;
    // }
    let address = this.#kvStore[key].address;
    let totalBytes = this.#kvStore[key].totalBytes;
    setTimeout(async () => {
      try {
        let data = await utils.getStoredContentPromise(
          path.join(this.#dataDir, this.#logfilename),
          address,
          totalBytes
        );
        if (
          this.#kvStore[key] &&
          !utils.checkHash(this.#kvStore[key].checkSum, data)
        ) {
          cb(null);
          return;
        }
        if (data) {
          cb(
            data.substring(
              String(key).length +
                constants.keySeparatorLength +
                constants.messagePaddingLLength +
                1,
              totalBytes - 2
            )
          );
        }
      } catch (error) {
        console.error(error);
      }
    }, 100);
  }

  /**
   *
   * @param {String} key
   * Synchronously finds and returns data corresponding to given key
   */
  getSync(key) {
    utils.validateKey(key, this.#kvStore);
    if (this.#pendingData[key]) {
      return this.#pendingData[key];
    }
    if (this.#kvStore[key] == undefined) {
      return null;
    }
    let dataOnMemory = this.#kvStore[key].data;
    if (dataOnMemory != null) {
      return dataOnMemory;
    }
    let address = this.#kvStore[key].address;
    let totalBytes = this.#kvStore[key].totalBytes;
    let buffer = Buffer.alloc(totalBytes);
    try {
      let fd = fs.openSync(path.join(this.#dataDir, this.#logfilename), "r");
      // fs.readSync(fd, buffer, { length: totalBytes, position: address });
      fs.readSync(fd, buffer, 0, totalBytes, address);
      fs.close(fd);
      let data = buffer.toString("utf-8");
      if (
        this.#kvStore[key] &&
        !utils.checkHash(this.#kvStore[key].checkSum, data)
      ) {
        return null;
      }
      if (data) {
        return data.substring(
          String(key).length +
            constants.keySeparatorLength +
            constants.messagePaddingLLength +
            1,
          totalBytes - 2
        );
      } else {
        return null;
      }
    } catch (error) {
      if (error) {
        console.error(error);
        // throw error;
        return;
      }
    }
  }

  /**
   * @param {String} key
   * @param {String} message
   * @param {function(Error | undefined)} cb
   *  log asynchronously stores the `key` to a json object and the `message` object out of memory for efficient speed and memory optimisation
   */
  log(key, message, cb) {
    if (!this.#kvStore[constants.kvEmbeddedKey]) {
      this.#kvStore[constants.kvEmbeddedKey] = utils.getEmptyEmbedObject();
    }
    if (this.#isCompactionInProgress) {
      this.#pendingData[key] = message;
      return;
    }
    let isMessageValid = utils.validateMessage(message);
    let isKeyValid = utils.validateKey(key, this.#kvStore);
    if (isKeyValid && isMessageValid) {
      let data = key + "," + JSON.stringify({ bin: message });
      let messageHash = utils.getHash(data);
      if (this.#kvStore && this.#kvStore[key]) {
        this.#kvStore[constants.kvEmbeddedKey]["unreferencedBytesCount"] +=
          this.#kvStore[key].totalBytes;
      }
      utils.addKeyToKV(
        this.#kvStore,
        key,
        messageHash,
        data.length,
        this.#seek,
        message
      );
      setTimeout(() => {
        if (this.#kvStore[key].data == null) return;
        data = key + "," + JSON.stringify({ bin: this.#kvStore[key].data });
        this.#kvStore[key].data = null;
        this.#kvStore[key].address = this.#seek;
        this.#kvStore[key].totalBytes = data.length;
        this.#seek += data.length;
        let ws = fs.createWriteStream(
          path.join(this.#dataDir, this.#logfilename),
          { flags: "a", encoding: "utf-8" }
        );
        ws.write(data, (err) => {
          if (err) {
            cb(err);
          }
        });
        ws.on("drain", () => {
          ws.close();
          cb(null);
        });
      }, 0);
    }
  }

  #onCompactionEnd = (actionOnTrue) => {
    if (this.#isCompactionInProgress) {
      setTimeout(() => {
        this.#onCompactionEnd(actionOnTrue);
      }, 100);
    } else {
      actionOnTrue();
    }
  };

  /**
   * @param {[String]} key
   * @param {[String]} message
   *  Synchronously stores the key value data.
   */
  logSync(key, message) {
    if (!this.#kvStore[constants.kvEmbeddedKey]) {
      this.#kvStore[constants.kvEmbeddedKey] = utils.getEmptyEmbedObject();
    }
    if (this.#isCompactionInProgress) {
      this.#pendingData[key] = message;
      return;
    }
    let isMessageValid = utils.validateMessage(message);
    let isKeyValid = utils.validateKey(key, this.#kvStore);
    if (isKeyValid && isMessageValid) {
      let data = key + "," + JSON.stringify({ bin: message });
      if (this.#kvStore && this.#kvStore[key]) {
        this.#kvStore[constants.kvEmbeddedKey]["unreferencedBytesCount"] +=
          this.#kvStore[key].totalBytes;
      }
      let messageHash = utils.getHash(data);
      utils.addKeyToKV(
        this.#kvStore,
        key,
        messageHash,
        data.length,
        this.#seek
      );
      this.#seek += data.length;
      this.#kvStore[key].data = null;
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
      this.#seek = 0;
      clearInterval(this.#compactionSetInterval);
      clearInterval(this.#backupKVSetInterval);
    } catch (error) {
      if (error) throw error;
    }
  }

  /**
   *
   * @param {String} key
   * @param {String} message
   * @param {function(Error | null)} cb
   * put asynchronously stores the `key` to a json object and the `message` object out of memory for efficient speed and memory optimisation
   */
  put(key, message, cb) {
    return this.log(key, message, cb);
  }

  /**
   *
   * @param {String} key
   * @param {String} message
   * Synchronously stores the key value data.
   */
  putSync(key, message) {
    return this.logSync(key, message);
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
    if (
      typeof this.#kvStore === "object" &&
      this.#kvStore[key] &&
      !this.#kvStore[key].deleted
    ) {
      this.#kvStore[key].deleted = true;
      this.#kvStore[constants.kvEmbeddedKey]["contentLength"] -=
        this.#kvStore[key].totalBytes;
      this.#kvStore[constants.kvEmbeddedKey]["activeKeyCount"] -= 1;
      this.#kvStore[constants.kvEmbeddedKey]["unreferencedBytesCount"] +=
        this.#kvStore[key].totalBytes;
      utils.createKVSnapshot(this.#kvSnapshotDir, this.#kvStore);
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
  async #compaction(tmpKVStore) {

    if (
      this.#isCompactionInProgress ||
      !this.#kvStore ||
      (this.#kvStore[constants.kvEmbeddedKey] &&
        this.#kvStore[constants.kvEmbeddedKey]["unreferencedBytesCount"] < 1)
    ) {
      this.#isCompactionInProgress = false;
      return false;
    }

    let unreferencedBytesCount =
      this.#kvStore[constants.kvEmbeddedKey]["unreferencedBytesCount"];

    this.#isCompactionInProgress = true;

    let tmpLogPath = path.join(__dirname, "..", "tmpLog.bin");
    // create tmp file
    fs.writeFile(tmpLogPath, "", (err) => {
      if (err) {
        console.error(err);
        this.#isCompactionInProgress = false;
        return false;
      }
    });
    try {
      let writerStream = fs.createWriteStream(tmpLogPath, {
        start: 0,
        flags: "a",
        // highWaterMark: 1,
      });
      let tmpSeek = 0;
      this.#kvStore[constants.kvEmbeddedKey]["unreferencedBytesCount"] = 0;
      let i = 0;
      let keys = Object.keys(tmpKVStore);
      this.writeToStream(
        writerStream,
        i,
        keys,
        path.join(this.#dataDir, this.#logfilename),
        tmpKVStore,
        tmpSeek,
        (event, updatedTmpSeek) => {
          tmpSeek = updatedTmpSeek;
          if (event == "end") {
            // this.#seek = tmpSeek;
            this.#kvStore = tmpKVStore;
            fs.copyFileSync(
              tmpLogPath,
              path.join(this.#dataDir, this.#logfilename)
            );

            this.#isCompactionInProgress = false;
            this.#kvStore[constants.kvEmbeddedKey]["unreferencedBytesCount"] -=
              unreferencedBytesCount;
            utils.createKVSnapshot(this.#kvSnapshotDir, this.#kvStore);
            this.putAll(this.#pendingData);
            this.#pendingData = {};
            return false;
          }
        }
      );
    } catch (error) {
      console.error(error);
      this.#isCompactionInProgress = false;
      return false;
    }
  }

  writeToStream = async (wstream, i, keys, filePath, kvStore, tmpSeek, cb) => {
    for (; i < keys.length; i++) {
      let key = keys[i];
      if (key == constants.kvEmbeddedKey) {
        continue;
      }
      let content = "";
      try {
        content = await utils.getStoredContentPromise(
          filePath,
          kvStore[key].address,
          kvStore[key].totalBytes
        );
      } catch (error) {
        if (error) {
          console.error(error);
        }
      }
      kvStore[key].address = tmpSeek;
      tmpSeek += content.length;
      if (!wstream.write(content)) {
        // Wait for it to drain then start writing data from where we left off
        wstream.once("drain", () => {
          this.writeToStream(
            wstream,
            i + 1,
            keys,
            filePath,
            kvStore,
            tmpSeek,
            cb
          );
        });
        return;
      }
    }
    wstream.end();
    this.#seek = tmpSeek;
    this.#kvStore[constants.kvEmbeddedKey]["seek"] = tmpSeek;
    cb("end", tmpSeek);
  };

  putAll(map) {
    let keys = Object.keys(map);
    for (let key of keys) {
      this.logSync(key, map[key]);
    }
  }

  /**
   *
   * @param {String} key
   * returns true if key exists
   */
  contains(key) {
    if (key && typeof key === "string") {
      if (
        this.#kvStore[key] &&
        !this.#kvStore[key].deleted &&
        this.#kvStore[key].checkSum
      ) {
        return true;
      }
    }
    return false;
  }

  isEmpty() {
    return this.keyCount() === 0;
  }
  /**
   * returns integer count of all active keys
   */
  size() {
    if (this.#kvStore && this.#kvStore[constants.kvEmbeddedKey]) {
      return this.#kvStore[constants.kvEmbeddedKey].activeKeyCount;
    }
    return 0;
  }
  /**
   *
   * returns a list of all active keys
   */
  keys() {
    if (this.#kvStore) {
      return Object.keys(this.#kvStore).filter((item) => {
        return item != constants.kvEmbeddedKey && !this.#kvStore[item].deleted;
      });
    }
    return [];
  }
}

module.exports = NodeBitcask;
