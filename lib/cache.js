var fs = require('fs'),
    runner = require('./runner.js');

// { metapath: {
//     filepath: { stat: ... , md5: ..., filepath: ... }
//   }
// }

var metaCache = {};

function loadMeta(opts) {
  var metaPath = opts.cachepath + '/meta.json';
  // have we loaded the cache meta.json?
  if(!metaCache[metaPath]) {
    // does the cache metadata file exist?
    metaCache[metaPath] = (fs.existsSync(metaPath) ? require(metaPath) : {});
  }
  return metaCache[metaPath];
}

function saveMeta(opts) {
  var metaPath = opts.cachepath + '/meta.json';
  if(!fs.existsSync(opts.cachepath)) {
    fs.mkdirSync(opts.cachepath);
  }
  fs.writeFileSync(metaPath, JSON.stringify(metaCache[metaPath], null, 2));
}

function lookup(opts) {
  var meta = loadMeta(opts),
      fileMeta = meta[opts.filepath];
  if(!opts.filepath || !fileMeta) {
    return false;
  }
  // if the md5 attribute is set, use it

  // else use the stat attribute
  if(fileMeta.stat && opts.stat) {
    if(!(fileMeta.stat.mtime instanceof Date)) {
      fileMeta.stat.mtime = new Date(fileMeta.stat.mtime);
    }
    if(fileMeta.stat.size == opts.stat.size && fileMeta.stat.mtime.getTime() == opts.stat.mtime.getTime()) {
      return fileMeta.filepath;
    }
  }
  return false;
}

function clear(opts) {
  var metaPath = opts.cachepath + '/meta.json',
      meta = loadMeta(opts);
  Object.keys(meta).forEach(function(filepath) {
    var item = meta[filepath];
    if(fs.existsSync(item.filepath)) {
      fs.unlink(item.filepath);
    }
  });
  metaCache[metaPath] = {};
  saveMeta(opts);
}

// execute
module.exports = function(opts, tasks, done) {
  var cacheFile = lookup(opts), last, cacheName;
  if(cacheFile) {
    last = { stdout: fs.createReadStream(cacheFile) };
    // attach done
    if(typeof done == 'function') {
      last.stdout.once('end', done);
    }
    // stream from cache
    return last;
  }
  // generate a new file name
  cacheName = opts.cachepath + '/' + Math.random().toString(36).substring(2);
  while(fs.existsSync(cacheName)) {
    cacheName = opts.cachepath + '/' + Math.random().toString(36).substring(2);
  }
  // return the runner result, but pipe it to the cache file first
  last = runner({ stdout: fs.createReadStream(opts.filepath) }, tasks, function() {
    // update the metadata cache
    var meta = loadMeta(opts);
    meta[opts.filepath] = {
      stat: opts.stat || fs.statSync(opts.filepath),
      filepath: cacheName
    };
    saveMeta(opts);
    done && done();
  });
  // pipe to the writable stream
  last.stdout.pipe(fs.createWriteStream(cacheName));
  return last;
};

// lookup
module.exports.lookup = lookup;

// clear
module.exports.clear = clear;
