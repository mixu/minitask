var fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp');

var CacheFile = require('./cache-file.js'),
    SafeMap = require('./safe-map.js'),
    cacheLookup = { };

function Cache(opts) {
  var data;
  this.opts = opts;
  this._file = {};
  this.path = opts.path;
  this.metaPath = null;

  // cache mode: default || transactional
  this.mode = 'default';
  this.fsStatCache = {};

  // separate storage for paths and data
  this._pathStore = null;
  this._metaStore = null;

  if(!this.path || !opts.method) {
    throw new Error('Must set the cache path and method');
  }

  // one file per method (using the same file for multiple methods is bad as
  // it can cause conflicts / overwrites etc. and requires longer paths)
  this.metaPath = path.normalize(this.path + '/meta-' + this.opts.method + '.json');

  try {
    if (fs.existsSync(this.metaPath)) {
      data = require(this.metaPath);
    } else {
      data = { path: {}, data: {} };
    }
    this._pathStore = new SafeMap(data.path || {});
    this._metaStore = new SafeMap(data.data || {});
  } catch(e) {
    console.error('');
    console.error('ERROR: The cache index file "' + this.metaPath + '" cannot be parsed as JSON.');
    console.error('To fix this issue, you should delete the folder "' +
      path.dirname(this.metaPath) + '" to clear the cache.');
    throw e;
  }

  // need to do this early on, since if the path is missing,
  // writes to the cache dir will fail
  if(!fs.existsSync(this.path)) {
    mkdirp.sync(this.path);
  }
}

// fetch cache by path and method
Cache.instance = function(opts) {
  var p = path.normalize(opts.path),
      method = opts.method;

  // remove trailing slash if it exists as path does not remove it
  if(p.charAt(p.length - 1) == path.sep) {
    p = p.substr(0, p.length - 1);
  }
  opts.path = p;

  if(cacheLookup[p] && cacheLookup[p][method]) {
    return cacheLookup[p][method];
  }
  if(!cacheLookup[p]) {
    cacheLookup[p] = {};
  }
  cacheLookup[p][method] = new Cache(opts);
  return cacheLookup[p][method];
};

Cache.prototype.data = function(key, value) {
  if(typeof value === 'undefined') {
    // get
    return this._getData(key);
  }
  // set
  this._setData(key, value);
};

Cache.prototype.file = function(path) {
  if(!this._file[path]) {
    this._file[path] = new CacheFile({
      path: path,
      cache: this,
      method: this.opts.method
    });
  }
  return this._file[path];
};

Cache.hash = Cache.prototype.hash = CacheFile._hash;

// ultimately the cache is responsible for garbage collecting these
// so it should also be responsible for storing them

Cache.prototype._getPath = function(key) {
  return this._pathStore.get(key);
};

Cache.prototype._getData = function(key) {
  return this._metaStore.get(key);
};

Cache.prototype._setPath = function(key, value) {
  this._pathStore.set(key, value);
  // skip save if in transactional mode
  if(this.mode == 'default') {
    this.save();
  }
};

Cache.prototype._setData = function(key, value) {
  this._metaStore.set(key, value);
  // skip save if in transactional mode
  if(this.mode == 'default') {
    this.save();
  }
};

// throttle?
Cache.prototype.save = function() {
  // just in case
  if(!fs.existsSync(this.path)) {
    mkdirp.sync(this.path);
  }
  fs.writeFileSync(this.metaPath, JSON.stringify({
    data: this._metaStore,
    path: this._pathStore
  }, null, 2));
};

Cache.prototype.begin = function() {
  this.mode = 'transactional';
  this.fsStatCache = {};
};

Cache.prototype.end = function() {
  this.mode = 'default';
  this.save();
};

Cache.prototype.clear = function() {
  var self = this;
  // empty out the root keys in data
  this._metaStore.clear();
  // delete all files
  var trackedFiles = Object.keys(this._getPath([]) || {});
  if(Array.isArray(trackedFiles)) {
    trackedFiles.forEach(function(trackedFile) {
      self._unlinkAssociatedFiles(trackedFile);
    });
  }
  // empty out the root keys in paths
  this._pathStore.clear();
  // save
  this.save();
};

Cache.prototype._unlinkAssociatedFiles = function(file) {
  var paths =  this._getPath([file, '_path']),
      basepath = this.path;
  // delete paths
  if(paths) {
    Object.keys(paths).forEach(function(key) {
      var item = paths[key];
      if(item.substr(0, basepath.length) != basepath) {
        // console.log('skip', item);
        return;
      }
      if(fs.existsSync(item)) {
        try {
          fs.unlinkSync(item);
        } catch(e) { }
        // console.log('unlinked', item);
      }
    });
  }
};

Cache.prototype.filepath = function() {
  var cacheName;
  // generate a new file name
  do {
    cacheName = this.path + '/' + Math.random().toString(36).substring(2);
  } while(fs.existsSync(cacheName));
  return cacheName;
};

module.exports = Cache;
