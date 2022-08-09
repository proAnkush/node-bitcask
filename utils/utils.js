const fs = require("fs");
const path = require("path");

/**
 * 
 * @param {Error} err 
 * can be used as callback for promises
 */
exports.handleErrorDefault = (err) => {
  if (err) {
    console.error(err);
    return true;
  }
  return false;
};

exports.getHash = (key) => {
  if (!key) {
    console.error("Please provide a string for genrating hash");
    return null;
  }
  const crypto = require("crypto");
  let hash = crypto.createHash("md5").update(key).digest("hex");
  return hash;
};

exports.checkHash = (hash, data) => {
  const crypto = require("crypto");
  if (!hash || !data) return false;
  return hash === crypto.createHash("md5").update(data).digest("hex");
};

/**
 *
 * @param {String} message
 * validates a `message` string, returns `true` if message is valid
 */
exports.validateMessage = (message) => {
  // return `false if invalid, and `true` if valid
  if (typeof message === "undefined") {
    console.log("message argument is not optional");
    return false;
  }
  if (typeof message !== "string") {
    console.log(`message should be of type string, not ${typeof message}`);
    return false;
  }
  return true;
};

/**
 *
 * @param {String} key
 * @param {Object} kvStore
 * validates `key` and also checks if `key` is in `kvstore`, returns `true` if valid
 */
exports.validateKey = (key, kvStore) => {
  if (typeof key === "undefined") {
    console.error("key cannot be undefined");
    return false;
  }
  if (typeof key !== "string") {
    console.log("key should be of type string");
    return false;
  }
  if (kvStore && kvStore[key] && kvStore[key].deleted == true) {
    return false;
  }
  return true;
};

/**
 *
 * @param {import("fs").PathLike} logFileDir
 * calculates where the `seek` should be placed for writing the content at the specific positions
 */
exports.calculateSeek = (logFileDir) => {
  // size of file is the current seek position
  let stats = fs.statSync(logFileDir);
  let fileSizeInBytes = stats.size;
  return fileSizeInBytes;
};

/**
 *
 * @param {PathLike} pathToFile
 * removes the entire content of the file, without deleting the file.
 */
exports.empty = (pathToFile) => {
  fs.open(pathToFile, "w", (err, fd) => {
    if (err) {
      throw err;
    }
    try {
      fs.write(fd, "", (err) => {
        if (err) {
          console.log(err);
          throw err;
        }
      });
    } catch (error) {}
  });
};

/**
 *
 * @param {PathLike} kvSnapshotDir
 * @param {Object} kvStore
 * stores the key-value store to `kvSnapshotDir` for persisting the database, since kvStore is on memory, power cut will result in data loss, hence this is essential
 */
exports.createKVSnapshot = (kvSnapshotDir, kvStore) => {
  fs.promises
    .open(kvSnapshotDir, "w")
    .then((fd) => {
      return fd.write(Buffer.from(JSON.stringify(kvStore))).then(() => {
        return fd;
      });
    })
    .then((fd) => {
      // console.log(result);
      fd.close();
    })
    .catch((err) => {
      if (err) {
        throw err;
      }
    });
};

/**
 * 
 * @param {} kvSnapshotDir
 * @param {} logFileDir 
 * 
 * reconstructs `kvstore` from the `kvSnapshotDir` on-disk snapshot .
 */
exports.readKVSnapshot = (kvSnapshotDir, logFileDir) => {
  // reading kv snapshot need to be synchronous
  // also recover seek
  let kvBuf;
  let seek = 0;
  try {
    kvBuf = fs.readFileSync(kvSnapshotDir).toString();
    seek = this.calculateSeek(logFileDir) || 0;
  } catch (error) {
    // console.log(kvSnapshotDir, logFileDir);
    fs.writeFileSync(kvSnapshotDir, "");
    fs.writeFileSync(logFileDir, "");
  }
  let kvStore = {};
  if (kvBuf && kvBuf.length != 0) {
    kvStore = JSON.parse(kvBuf) || {};
  }
  return [seek, kvStore];
};

exports.processTombstones = (tombstones, logFilePath) => {
  if (tombstones.length > 0) {
    fs.open(logFilePath, "r+", (err, fd) => {
      if (err) {
        throw err;
      }
      try {
        tombstones.forEach((tombstone) => {
          let buffer = Buffer.from(Array(tombstone.length + 1).join("~"));
          fs.write(
            fd,
            buffer,
            0,
            tombstone.length,
            tombstone.start,
            (err, written, buffer) => {
              if (err) {
                // console.log(fd, written, buffer, err);
                throw err;
              }
            }
          );
        });
      } catch (error) {
        console.error(error);
      }
    });
  }
};

exports.getStoredContent = (filePath, position, length, cb) => {
  // console.log(filePath, position, length, cb);
  // read to buffer
  let readToBuffer = Buffer.alloc(length);

  // go to address in the file and start reading
  setTimeout(() => {
    fs.open(filePath, "r", (err, fd) => {
      if (err) {
        throw err;
      }
      if (!fd) {
        throw Error("invalid fd");
      }
      try {
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
            fs.close(fd, this.handleErrorDefault);
            // buffer.slice(String(key).length+1, address+totalBytes-1);
            cb(decodeURIComponent(buffer.toString()));
            // .substring((String(key).length)+1, address+totalBytes-1))
          }
        );
      } catch (error) {
        if (error) {
          console.error(error);
          fs.close(fd, this.handleErrorDefault);
          cb(null);
        }
      }
    });
  });
};

exports.customUpdatingInterval = (fn, to) => {
  setTimeout(fn, to);
};
