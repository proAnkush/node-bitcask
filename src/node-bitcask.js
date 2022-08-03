const fs = require("fs");
const path = require("path");

const BinaryFile = require("binary-file");
const rootDir = require("../utils/rootDir");
const utils = require("../utils/utils");

class NodeBitcask {
  constructor(config) {
    this.dataDir = "./src/database";
    this.logfilename = "logfile.bin";
    this.kvSnapshotDir = "./src/kvSnapshot.bin";
    this.kvStore = {};
    this.seek = 0;
    if (config && config.dataDir) {
      this.dataDir = config.dataDir;
      console.log(this.dataDir);
      // fs.exists is deprecated
      if (fs.existsSync(this.kvSnapshotDir) === true) {
        this.kvStore = { test: "seek" };
        // this.readKVSnapshot()
        console.log(this.kvStore, "kv store snapshot found");
      } else {
        console.log("fresh kv store");
      }
    }
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir);
      console.log("created datadir");
    }
    console.log(this.dataDir, this.kvStore, config);
    fs.writeFile(path.join(this.dataDir, "test.bin"), "", (err) => {
      if (err) {
        console.log(err);
      }
    });
  }

  get(key) {
    // find address for provided key
    // if(this.validateKey(key) === false){
    //   throw Error("invalid key");
    // // }
    let address = this.kvStore[key].address;
    let totalBytes = this.kvStore[key].totalBytes;
    // let address = 14;
    // let totalBytes = 7;

    // go to address in the file and start reading till end-flag
    let buf = Buffer.alloc(totalBytes);

    fs.open(path.join(this.dataDir, this.logfilename), "r", (err, fd) => {
      try {
        let offset = 0; //
        let length = totalBytes; // totalBytes
        let position = address; // address
        fs.read(fd, buf, offset, length, position, (err, bytesRead, buffer) => {
          utils.handleErrorDefault(err);
          // console.log(bytesRead, "total bytes");
          // console.log(buffer.toString(), " buff")
          console.log(decodeURIComponent(buffer.toString()));
        });
      } catch (error) {
        console.log("err");
      } finally {
        fs.close(fd, utils.handleErrorDefault);
      }
    });
  }
  validateKey(key) {
    if (typeof key === "undefined") {
      return Error("argument to key is not optional");
    }
    if (!this.kvStore[key]) {
      return Error("key cannot be found in database");
    }
    if (typeof key !== "string") {
      return Error("key should be of type string");
    }
    // more validation
    return null;
  }

  log(key, message) {
    let validationError = validateMessage(message);
    message = String(message);
    if (validationError) {
      throw valdationError;
    }
    this.kvStore[key] = {
      address: this.seek,
      totalBytes: message.length,
      checksum: null,
    };
    this.seek += message.length;
    console.log(this.kvStore, this.seek);
    // store as plain text
    fs.appendFile(
      path.join(this.dataDir, this.logfilename),
      message,
      utils.handleErrorDefault
    );
  }

  validateMessage(message) {
    if (typeof message === "undefined") {
      return Error("message argument is not optional");
    }
    message = String(message);
    if (typeof message !== "string") {
      return Error(`message should be of type string, not ${typeof message}`);
    }
    return null;
  }

  put(key, message) {
    this.log(key, message);
  }

  createKVSnapshot() {
    fs.writeFile(
      path.join(this.dataDir, this.logfilename),
      JSON.stringify(this.kvStore),
      handleErrorDefault
    );
  }

  readKVSnapshot() {
    // reading kv snapshot need to be synchronous
    // also recover seek
    this.kvStore = JSON.parse(
      fs.readFileSync(path.join(this.dataDir, this.logfilename))
    );
  }

  unload() {
    fs.rmSync(this.dataDir, { recursive: true, force: true });
    fs.unlink(this.kvSnapshotDir, (err) => {
      if (err) {
        console.log(err);
      }
    });
  }
}

module.exports = NodeBitcask;
