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
  return true;
};

exports.calculateSeek = (kvDict) => {
  // assign seek
  let count = 0;
  for (let kv of Object.keys(kvDict)) {
    count += kvDict[kv].totalBytes;
  }
  return count;
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
