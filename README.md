# Node-Bitcask ![node_version](https://img.shields.io/badge/node-lts-brightgreen) ![npm_version](https://img.shields.io/badge/npm-8.5.3-yellowgreen)

## [Whats bitcask, you ask?](https://docs.riak.com/riak/kv/2.2.3/setup/planning/backend/bitcask/index.html)

>"Bitcask[^1] is an Erlang application that provides an API for storing and retrieving key/value data using log-structured hash tables that provide very fast access. The design of Bitcask was inspired, in part, by log-structured filesystems and log file merging." - riak docs
 

[**node-bitcask**](https://www.npmjs.com/package/node-bitcask) is a open source NodeJS implementation of the proposed storage engine. It is a log structured hash table.

Log structured: Data structure that allows append operations only, to utilise the sequential speeds of traditional mechanical hard drives.

Hash tables: In memory Key-Value pairs with O(1) read and write complexity.

node-bitcask allows asynchronous and synchronous operations on such a log structured hash table, where values are md5 verified, to store and provide data accurately. It also features resilience to power outage with snapshots, vertical scalability, space optimization by periodic compaction.
<br>
<br>
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
<!-- zebra: the coolest looking animal of all time. -->

## API
---
- [Inserting data](#inserting-data)
- [Accessing data](#accessing-data)
- [Exporting the database](#Exporting-the-database)
- [Importing previous database](#Importing-previous-database)
- [Deleting a log](#Deleting-a-log)
- [Deleting the database](#Deleting-the-database)
- [Check if key exists](#Checking-if-key-exists)
- [Check if empty](#Checking-if-empty)
- [Getting total keys count](#Getting-total-keys-count)
- [Iterating over the keys](#Iterating-over-the-keys)
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
<br>

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
<br>

### **Checking if key exists**
To check if nb contains a undeleted key, use:
```js
nb.contains(key)
```
returns `true` if `key` is present in nb.
<br>

### **Checking if empty**
```js
nb.isEmpty()
```
returns `true` if nb is empty. This can be due no log operation executed, or every key is deleted.
<br>
### **Getting total keys count**
```js
nb.size()
```
Returns an Integer which equals to the count of active keys in nb.

### **Iterating over the keys**
nb allows reading sequentially over all the active keys.
```js
const keys = nb.keys()
for(let key of keys){
    console.log(nb.getSync(key));
}
```
will iterate over all keys in nb and read them synchronously
<br>
<br>

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

<!-- just a thought. -->
- Why not cache frequently accessed keys? Good observation, still cache system like redis will be helpful only if it is run on another physical machine. Running it concurrently will affect the file system access performance of node-bitcask, since -as mentioned already-  nodejs file system operations utilize thread pool, one less cpu thread will marginally drop the performance of node-bitcask. Integrating node-bitcask on a completely different stand alone hardware might be better choice, always.

## Known Issues
---
<!-- Major Issue: No dependants yet -->
- ~~Sync read and writes will fail during compaction. Please prefer using async variations of both until future updates.~~
- Some writes between creating snapshot and powerloss/SIGTERM will be available in logfile, but no references will be written in snapshot.
- Current storage format for data can be improved.

## Changelogs
---
<!-- 07 September 2022 -->
**Version 1.0.0-beta.4**
- Optimised write performance when consecutively writing to the same key asynchronously. Also decreased fs access for the same. Prefer using async operations.
- Faster reads when reading immediately after async write.
- Fix sync operations during compaction.
- Closing file descriptor opened during `getSync()`

<!-- 19 August 2022 -->
**Version 1.0.0-beta.3**

- Compaction fix for data exceeding writeStream highwatermark(1kb).
- Queueing async get() and log() until compaction ends for consistency.
- Fix deletion for already deleted keys.
- Added helpfull utils like `isEmpty()`, `keys()`, `contains(key)`, `size()` for better manipulation and querying.
- Persisting garbage collectible information, so compaction can be efficient on imported database.
- Known issues section in README.

**Version 1.0.0-beta.2**

- Removed stream api.
- Added md5 checksums (crypto module) for verifying the integrity of written data.
- Replace setTimeout with setInterval for compaction.
- Fixed `WriteStream` used internally for compaction would not emit *close* event, also replace listener from *close* to *drain* event.
- Convert basic operations to asynchronous operations.
- Added synchronous functions.
- Added changelogs to README
- Some more minor fixes.

**Version 1.0.0-beta.1**
- Fixed undefined instance variables of node-bitcask resulted in failure of most operations
- Removed test operations from index.js which would get executed on importing node-bitcask.
- Handled file doesn't exist.
- Made internal variables and function private.
- Removed most of the debug logs

## References
---
1. Bitcask - Riak Docs. [^1]
2. Designing Data Intensive Applications by Martin Kleppmann.(came across bitcask reading this one, great book) [^2]
3. Bitcask Paper. [^3]


[^1]: https://docs.riak.com/riak/kv/2.2.3/setup/planning/backend/bitcask/index.html
[^2]: https://www.amazon.in/Designing-Data-Intensive-Applications-Reliable-Maintainable-ebook/dp/B06XPJML5D
[^3]: https://riak.com/assets/bitcask-intro.pdf
[^4]: https://www.youtube.com/watch?v=zphcsoSJMvM

