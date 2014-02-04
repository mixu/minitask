var fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp');

var CacheFile = require('./cache-file.js'),
    cacheLookup = { };

function Cache(opts) {
  this.opts = opts;
  this._data = null;
  this._file = {};
  this.path = opts.path;

  if(!opts.path || !opts.method) {
    throw new Error('Must set the cache path and method');
  }

  this.metaPath = path.normalize(opts.path + '/meta.json');

  try {
    this._data = (fs.existsSync(this.metaPath) ? require(this.metaPath) : {});
  } catch(e) {
    console.error('');
    console.error('ERROR: The cache index file "' + this.metaPath + '" cannot be parsed as JSON.');
    console.error('To fix this issue, you should delete the folder "' +
      path.dirname(this.metaPath) + '" to clear the cache.');
    throw e;
  }

  // need to do this early on, since if the path is missing,
  // writes to the cache dir will fail
  if(!fs.existsSync(this.opts.path)) {
    mkdirp.sync(this.opts.path);
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
    return this._get(key);
  }
  // set
  this._set(key, value);
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

Cache.prototype._get = function(key) {
  // adds a "method" prefix.
  // { "method" : { "file": { key: value } } } }
  var parts = [ this.opts.method ].concat(key),
      result = this._data,
      i;

  try {
    for(i = 0; i < parts.length; i++) {
      if(typeof result[parts[i]] === 'undefined') {
        return undefined;
      }
      result = result[parts[i]];
    }
  } catch(e) {
    return undefined;
  }
  return result;
};

Cache.prototype._set = function(key, value) {
  // adds a "method" prefix
  var parts = [ this.opts.method ].concat(key),
      current = this._data,
      i;
  for(i = 0; i < parts.length - 1; i++) {
    if(current[parts[i]] === null || typeof current[parts[i]] != 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  if(current[parts[i]] === null || typeof current[parts[i]] != 'object') {
    current[parts[i]] = {};
  }
  current[parts[parts.length - 1]] = value;

  this.save();
};

Cache.prototype.save = function() {
  // just in case
  if(!fs.existsSync(this.opts.path)) {
    mkdirp.sync(this.opts.path);
  }
  fs.writeFileSync(this.metaPath, JSON.stringify(this._data, null, 2));
};

Cache.prototype.clear = function() {
  var self = this;
  // delete any lingering files
  Object.keys(this._data).forEach(function(inputFilePath) {
    self.junk(inputFilePath);
  });
  this._data = {};
  this.save();
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
