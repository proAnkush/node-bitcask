# Node-Bitcask ![node_version](https://img.shields.io/badge/node-lts-brightgreen) ![npm_version](https://img.shields.io/badge/npm-8.5.3-yellowgreen)

## [Whats bitcask, you ask?](https://docs.riak.com/riak/kv/2.2.3/setup/planning/backend/bitcask/index.html)

>"Bitcask[^1] is an Erlang application that provides an API for storing and retrieving key/value data using log-structured hash tables that provide very fast access. The design of Bitcask was inspired, in part, by log-structured filesystems and log file merging." - riak docs
 

**node-bitcask** is a NodeJS implementation of the proposed storage system, without depending on third party node_modules.

## Installation
---
Install via npm: 
```properties
npm install node-bitcask
```

## Instantiation
---
Using node-bitcask is extremely simple. node-bitcask can be imported with ES5 `require()`.
```js
const nb = require('node-bitcask');
nb.put("zebra", "an African wild animal that looks like a horse, with black or brown and white lines on its body");
nb.get("zebra");
```

## API
---
- [Inserting data](#inserting-data)
- [Accessing data](#accessing-data)
- [Exporting the database](#Exporting-the-database)
- [Importing previous database](#Importing-previous-database)
- [Deleting a log](#Deleting-a-log)
- [Deleting the database](#Deleting-the-database)
<br><br>
### **Inserting data**
Data can be simply stored with:
```js
put(key, data, callback)
```
`key` is unique entity String that can be used to refer back to the  `data`. Put returns void, and asynchronously stores the data.<br>

**Note:** `putSync(key, data)` is also available for synchronous *put* operation.
<br><br>

### **Accessing data**
To get back your data use:
```js
get(key, callback)
```
`get` asynchronously find `key` referenced data and on success, provides the data to given callback. In case no data is found (maybe due to deleted key, incomplete storage, power-outage, bugs etc) `callback` will be invoked with `null` argument.<br>
**Note:** `getSync(key)` is also available for synchronous *get* operation.

### **Exporting the database**
To export the database essential files
```js
exportDataSync(newLogFileDir, newKVFileDir)
```
`logFile` is an essential file which contains the entire data of the database.
`kvFile` keeps a snapshot of the in memory kv-store, just in case a power-outage occurs, or anything else goes wrong. <br>
exportsDataSync accepts two `fs.PathLike` arguments which are used to copy the data to. <br>
It synchronously copies all the data to given paths.<br><br>

### **Importing previous database**
To import previously exported data use:
```js
importDataSync(oldLogFileDir, oldKVFileDir)
```
`oldLogFileDir` and `oldKVFileDir` are paths to where kvfile and logfiles were copied to. `importDataSync` first synchronously copies the data to its desired directory. After the copying succeeds the entire database is reconstructed from these files.<br><br>

### **Deleting a log**

```js
deleteLog(key)
```
Deletes the key. <br>
**Note:** after deletion, the data may still exist in the logfile for a small duration. 
<!-- actually the key still exists in the kv store but it is marked as a tombstone. The data is technically deleted when the compaction process starts. The compaction process reduces the size of logfile. -->
<br>

### **Deleting the database**
To delete all the data and the KV store use:
```js
nb.unload()
```

## Configuration
---
node-bitcask allows for greater configuration of where data is stored, when to do compaction, etc. Configuring node-bitcask is as simple as: 
```js
const nb = require("node-bitcask");
nb.configure({
    dataDir: "./some/arbitrary/folder",
    kvSnapshotPath: "./path/to/file",
    backupKVInterval: 1000, //in ms
    compactionInterval: 10000, //in ms
})
```
You can omit any key that you dont want to configure, and its value will stay to default.

## Some special notes
---
- Old time fans will remember there used to be Stream api for reading and writing large data with putStream and getStream. Sadly these features had to go, as hashing this large stream of data wouldn't be possible.

- *async fs* operations are handled by thread pool in nodejs. So performance of these operations will depend on the count of CPU cores in the system, and their respective speed. i.e. A single logical cpu core can do one fs operation at a time, so 4c/8t cpu will handle 8 fs operations concurrently.[^4]

## References
---
1. Bitcask - Riak Docs. [^1]
2. Designing Data Intensive Applications by Martin Kleppmann.(came across bitcask reading this one, great book) [^2]
3. Bitcask Paper. [^3]


[^1]: https://docs.riak.com/riak/kv/2.2.3/setup/planning/backend/bitcask/index.html
[^2]: https://www.amazon.in/Designing-Data-Intensive-Applications-Reliable-Maintainable-ebook/dp/B06XPJML5D
[^3]: https://riak.com/assets/bitcask-intro.pdf
[^4]: https://www.youtube.com/watch?v=zphcsoSJMvM

