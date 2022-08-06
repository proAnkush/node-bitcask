const fs = require("fs");
const path = require("path");
exports.handleErrorDefault = (err) => {
  if (err) {
    console.error(err);
    return true;
  }
  return false;
};

exports.validateMessage = (message) => {
  // return false if invalid, and true if valid
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

exports.calculateSeek = (logFileDir) => {
  // assign seek
  // size of file is the current seek position
  let stats = fs.statSync(logFileDir);
  let fileSizeInBytes = stats.size;
  return fileSizeInBytes;
};

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

exports.createKVSnapshot = (kvSnapshotDir, kvStore) => {
  // fs.open(kvSnapshotDir, "w", (err, fd) => {
  //   if (err) {
  //     throw err;
  //   }
  //   try {
  //     let kvBuffer = Buffer.from(JSON.stringify(kvStore));
  //     fs.write(fd, kvBuffer, (err) => {
  //       if (err) {
  //         throw err;
  //       }
  //     });
  //   } catch (error) {
  //     console.error(error);
  //   }
  // });
  fs.promises
    .open(kvSnapshotDir, "w")
    .then((fd) => {
      return fd.write(Buffer.from(JSON.stringify(kvStore)));
    })
    .then((result) => {
      // console.log(result);
    })
    .catch((err) => {
      if (err) {
        throw err;
      }
    });
};

exports.readKVSnapshot = (kvSnapshotDir, logFileDir) => {
  // reading kv snapshot need to be synchronous
  // also recover seek
  let kvBuf = fs.readFileSync(kvSnapshotDir).toString();
  let kvStore = {};
  if (kvBuf.length != 0) {
    kvStore = JSON.parse(kvBuf) || {};
  }
  let seek = this.calculateSeek(logFileDir) || 0;
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
                console.log(fd, written, buffer, err);
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
  console.log(filePath, position, length, cb);
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
