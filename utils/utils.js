const fs = require("fs");
const path = require("path");

const constants = require("../constants.json");

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
    console.error("message argument is not optional");
    return false;
  }
  if (typeof message !== "string") {
    console.error(`message should be of type string, not ${typeof message}`);
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
          console.error(err);
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


exports.getStoredContent = (filePath, position, length, cb) => {
  // console.log(filePath, position, length, cb);
  // read to buffer

  if (!filePath || !position || !length) {
    cb(null);
  }
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
            cb(buffer.toString());
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
  }, 1000);
};
exports.getStoredContentPromise = (filePath, position, length) => {
  // console.log(filePath, position, length, cb);
  // read to buffer
  return new Promise((resolve, reject) => {
    // if (!filePath || !position || !length) {
    //   console.error("///;;;+>", filePath, position, length);
    //   reject(new Error("fp or pos or len is null"));
    // }
    let readToBuffer = Buffer.alloc(length);

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
              resolve(buffer.toString());
              // .substring((String(key).length)+1, address+totalBytes-1))
            }
          );
        } catch (error) {
          if (error) {
            console.error(error);
            fs.close(fd, this.handleErrorDefault);
            reject(error);
          }
        }
      });
    }, 1000);
  });

  // go to address in the file and start reading
};

exports.addKeyToKV = (kv, key, messageHash, dataLength, seek, data) => {
  kv[key] = {
    checkSum: messageHash,
    totalBytes: dataLength,
    address: seek,
    data: data,
  };
  seek += dataLength;
  kv[constants.kvEmbeddedKey]["activeKeyCount"] += 1;
  kv[constants.kvEmbeddedKey]["contentLength"] += dataLength;
  kv[constants.kvEmbeddedKey]["seek"] += dataLength;
};

exports.getEmptyEmbedObject = () => {
  return {
    activeKeyCount: 0,
    contentLength: 0,
    seek: 0,
    unreferencedBytesCount: 0,
  };
};

exports.customUpdatingInterval = (fn, to) => {
  setTimeout(fn, to);
};

exports.writeToStream = async (
  wstream,
  i,
  keys,
  filePath,
  kvStore,
  tmpSeek,
  cb
) => {
  for (; i < keys.length; i++) {
    let key = keys[i];
    if (key == constants.kvEmbeddedKey) {
      continue;
    }
    let content = "";
    try {
      content = await this.getStoredContentPromise(
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
  cb("end", tmpSeek);
};