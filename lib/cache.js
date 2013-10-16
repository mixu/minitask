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

function statEqual(actual, expected) {
  if(!actual || !expected) {
    return false;
  }

  var a = (actual.mtime instanceof Date ? actual.mtime : new Date(actual.mtime)),
      b = (expected.mtime instanceof Date ? expected.mtime : new Date(expected.mtime));

  return actual.size == expected.size && a.getTime() == b.getTime();
}

exports.lookup = function lookup(opts) {
  var meta = loadMeta(opts),
      fileMeta = meta[opts.filepath],
      method = opts.method || 'stat';

  // if:
  // 1) the input file file path or
  // 2) the cache metadata for the file or
  // 3) the input task hash
  // is missing no cached values can be fetched
  if(!opts.filepath || !fileMeta || !opts.options) {
    return false;
  }

  var inputFileChanged = true; // assume changed
  // has the file changed?
  console.log('Cache lookup!', method, fileMeta);

  if(method == 'stat') {
    inputFileChanged = statEqual(opts.stat || fs.statSync(opts.filepath), fileMeta.stat);
  } else if(fileMeta.hash) {
    inputFileChanged = (fileMeta.hash == exports.hash(method, fs.readFileSync(opts.filepath)));
  }

  // if the input file changes, then all the cached values are invalidated
  if(inputFileChanged) {
    removeCached(meta, opts.filepath);
    return false;
  }

  // now, search for a cached file that corresponds to the current task hash



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
      hash: exports.hash(method, fs.readFileSync(opts.filepath)),
      filepath: cacheName
    };
  }
  // store options
  if(opts.options) {
    meta[opts.filepath].options = JSON.parse(JSON.stringify(opts.options));
    console.log('set', opts.filepath, meta[opts.filepath].options);
  }
  saveMeta(opts);
};

exports.hash = function(method, str) {
  // method is optional, defaults to md5
  if(arguments.length === 1) {
    str = method;
    method = 'md5';
  }
  return crypto.createHash(method).update(str).digest('hex');
};
