var fs = require('fs'),
    crypto = require('crypto'),
    assert = require('assert'),
    runner = require('./runner.js');

var metaCache = {};

function loadMeta(opts) {
  var metaPath = opts.cachepath + '/meta.json';
  // have we loaded the cache meta.json?
  if(!metaCache[metaPath]) {
    // does the cache metadata file exist?
    metaCache[metaPath] = (fs.existsSync(metaPath) ? require(metaPath) : {});
    if(!fs.existsSync(opts.cachepath)) {
      fs.mkdirSync(opts.cachepath);
    }
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

function removeCached(meta, filepath) {
  var item = meta[filepath];
  if(!item) {
    return; // nothing to do
  }
  if(fs.existsSync(item.filepath)) {
    fs.unlink(item.filepath);
  }
  delete meta[filepath];
}

exports.lookup = function lookup(opts) {
  var meta = loadMeta(opts),
      fileMeta = meta[opts.filepath],
      method = opts.method || 'stat';

  if(!opts.filepath || !fileMeta) {
    return false;
  }
  // if the options do not match, then this is not a match
  // - also, invalidate the cache entry
  if(opts.options) {
    if(!fileMeta.options) {
      removeCached(meta, opts.filepath);
      return false;
    }
    // assert.deepEqual is quite accurate
    try {
      assert.deepEqual(opts.options, fileMeta.options);
    } catch(e) {
      removeCached(meta, opts.filepath);
      return false;
    }
  }

  if(method == 'stat') {
    if(!fileMeta.stat) {
      return false;
    }
    var stat = opts.stat || fs.statSync(opts.filepath);
    // use the stat attribute
    if(!(fileMeta.stat.mtime instanceof Date)) {
      fileMeta.stat.mtime = new Date(fileMeta.stat.mtime);
    }
    if(!(stat.mtime instanceof Date)) {
      stat.mtime = new Date(stat.mtime);
    }
    if(fileMeta.stat.size == stat.size && fileMeta.stat.mtime.getTime() == stat.mtime.getTime()) {
      return fileMeta.filepath;
    }
  } else {
    if(!fileMeta.hash) {
      return false;
    }
    var hash = crypto.createHash(method).update(fs.readFileSync(opts.filepath)).digest('hex');
    if (fileMeta.hash == hash) {
      return fileMeta.filepath;
    }
  }
  return false;
};

exports.clear = function clear(opts) {
  var metaPath = opts.cachepath + '/meta.json',
      meta = loadMeta(opts);
  Object.keys(meta).forEach(function(filepath) {
    removeCached(meta, filepath);
  });
  metaCache[metaPath] = {};
  saveMeta(opts);
};

exports.filename = function(opts) {
  var cacheName;
  // generate a new file name
  do {
    cacheName = opts.cachepath + '/' + Math.random().toString(36).substring(2);
  } while(fs.existsSync(cacheName));
  return cacheName;
};

exports.complete = function(cacheName, opts) {
  // update the metadata cache
  var meta = loadMeta(opts),
      method = opts.method || 'stat';

  if(method == 'stat') {
    meta[opts.filepath] = {
      stat: opts.stat || fs.statSync(opts.filepath),
      filepath: cacheName
    };
  } else {
    meta[opts.filepath] = {
      hash: crypto.createHash(method).update(fs.readFileSync(opts.filepath)).digest('hex'),
      filepath: cacheName
    };
  }
  // store options
  if(opts.options) {
    meta[opts.filepath].options = JSON.parse(JSON.stringify(opts.options));
  }
  saveMeta(opts);
};
