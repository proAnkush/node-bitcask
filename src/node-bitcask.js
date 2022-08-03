const fs = require("fs");
const path = require("path");

const utils = require("../utils/utils");

class NodeBitcask {
  constructor(config) {
    this.dataDir = "./src/database";
    this.logfilename = "logfile.bin";
    this.kvSnapshotDir = "./src/kvSnapshot.bin";
    this.kvStore = {};
    this.seek = 0;
    this.readKVSnapshot();
    if (config && config.dataDir) {
      this.dataDir = config.dataDir;
    }
    try {
      fs.mkdirSync(this.dataDir);
      fs.writeFileSync(path.join(this.dataDir, this.logfilename), "");
    } catch {
      // error because dir exists
    }
  }

  get(key, cb) {
    utils.validateKey(key);
    if (this.kvStore[key] == undefined) {
      return null;
    }
    let address = this.kvStore[key].address;
    let totalBytes = this.kvStore[key].totalBytes;
    // read to buffer
    let readToBuffer = Buffer.alloc(totalBytes);

    // go to address in the file and start reading
    fs.open(path.join(this.dataDir, this.logfilename), "r", (err, fd) => {
      if (err) {
        throw err;
      }
      try {
        fs.read(
          fd,
          readToBuffer,
          0,
          totalBytes,
          address,
          (err, bytesRead, buffer) => {
            utils.handleErrorDefault(err);
            cb(decodeURIComponent(buffer.toString()));
            console.log("ecxplicit: ", decodeURIComponent(buffer.toString()));
          }
        );
      } catch (error) {
        if (error) {
          cb(null);
          throw err;
        }
      } finally {
        fs.close(fd, utils.handleErrorDefault);
      }
    });
  }
  /**
   *
   * @param {[String]} key [a key which can be used as index]
   * @param {[Buffer]} message [a buffer object for the value relating to provided key]
   * @return
   * log stores the key to a json object and the message object out of memory for efficient speed and memory optimisation
   */
  log(key, message) {
    /* stores the log */
    let isMessageValid = utils.validateMessage(message);
    let isKeyValid = utils.validateKey(key, this.kvStore);

    if (isKeyValid && isMessageValid) {
      this.kvStore[key] = {
        address: this.seek,
        totalBytes: message.length,
        checksum: null,
      };
      this.seek += message.length;
      // store as plain text
      fs.appendFile(
        path.join(this.dataDir, this.logfilename),
        message,
        (err) => {
          if (err) {
            throw err;
          }
          this.createKVSnapshot();
        }
      );
    }
  }

  createKVSnapshot() {
    fs.open(this.kvSnapshotDir, "w", (err, fd) => {
      if (err) {
        throw err;
      }
      let kvBuffer = Buffer.from(JSON.stringify(this.kvStore));
      fs.write(fd, kvBuffer, (err) => {
        if (err) {
          throw err;
        }
      });
    });
  }

  readKVSnapshot() {
    // reading kv snapshot need to be synchronous
    // also recover seek
    let kvBuf = fs.readFileSync(this.kvSnapshotDir).toString();
    if (kvBuf.length != 0) {
      console.log(JSON.parse(kvBuf));
      this.kvStore = JSON.parse(kvBuf) || {};
    }

    this.seek = utils.calculateSeek(this.kvStore);
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
  getSync() {
    console.log("not yet defined");
  }
  putSync() {
    console.log("not yet defined");
  }
}

module.exports = NodeBitcask;
