const fs = require("fs");
const path = require("path");

const utils = require("../utils/utils");

class NodeBitcask {
  constructor() {
    this.dataDir = path.join(__dirname, "..", "data");
    this.logfilename = "logfile.bin";
    this.kvSnapshotDir = "./src/kvSnapshot.bin";
    this.kvStore = {};
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
  }

  /**
   *
   * @param {String} key
   * @param {function} cb callback which will be called with the output.
   *
   * @returns
   */
  get(key, cb) {
    utils.validateKey(key);
    if (this.kvStore[key] == undefined) {
      return null;
    }
    let address = this.kvStore[key].address;
    let totalBytes = this.kvStore[key].totalBytes;
    let length = totalBytes - (String(key).length + 1);
    let position = address + String(key).length + 1;

    // read to buffer
    let readToBuffer = Buffer.alloc(length);

    // go to address in the file and start reading
    fs.open(path.join(this.dataDir, this.logfilename), "r", (err, fd) => {
      if (err) {
        throw err;
      }
      try {
        // let length = totalBytes-(String(key).length+1);
        // let position = address + String(key).length + 1;
        fs.read(
          fd,
          readToBuffer,
          0,
          length,
          position,
          (err, bytesRead, buffer) => {
            if (err) {
              console.error(err);
            }
            // buffer.slice(String(key).length+1, address+totalBytes-1);
            cb(decodeURIComponent(buffer.toString()));
            // .substring((String(key).length)+1, address+totalBytes-1))
          }
        );
      } catch (error) {
        if (error) {
          console.error(error);
          cb(null);
        }
      } finally {
        fs.close(fd, utils.handleErrorDefault);
      }
    });
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

    if (isKeyValid && isMessageValid) {
      // store as plain text
      fs.promises
        .open(path.join(this.dataDir, this.logfilename), "a")
        .then((fd) => {
          return fd
            .appendFile(key + ",")
            .then(() => {
              return fd;
            })
            .catch(utils.handleErrorDefault);
        })
        .then((fd) => {
          return fd
            .appendFile(message)
            .then(() => {
              return fd;
            })
            .catch(utils.handleErrorDefault);
        })
        .then((fd) => {
          fd.close();
          this.kvStore[key] = {
            address: this.seek,
            totalBytes: String(key).length + 1 + message.length,
            checksum: null,
          };
          this.seek += message.length + 1 + String(key).length;
          utils.createKVSnapshot(this.kvSnapshotDir, this.kvStore);
        })
        .catch((err) => {
          if (err) {
            console.error(err);
          }
        });
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
}

module.exports = NodeBitcask;
