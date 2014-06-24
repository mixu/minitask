var fs = require('fs'),
    path = require('path'),
    crypto = require('crypto');

function CacheFile(opts) {
  var self = this;
  if(!opts.path || !opts.method) {
    throw new Error('Must set the input file path and method');
  }

  this.opts = opts;
  this._lastValidate = 0;
  this._prefix = path.normalize(opts.path);

  // metadata related to this file
  this.setData = function(key, value) {
    self.opts.cache._setPath([self._prefix, '_data',  key], value);
  };
  this.getData = function(key) {
    return self.opts.cache._getPath([self._prefix, '_data',  key]);
  };
  // paths related to this file
  this.setPath = function(key, value) {
    self.opts.cache._setPath([self._prefix, '_path',  key], value);
  };
  this.getPath = function(key) {
    return self.opts.cache._getPath([self._prefix, '_path',  key]);
  };
  // hidden meta
  this.getExpected = function() {
    return self.opts.cache._getPath([self._prefix, '_expected', self.opts.method]);
  };
  this.setExpected = function(value) {
    self.opts.cache._setPath([self._prefix, '_expected', self.opts.method], value);
  };
  // bulk
  this.clearMetadata = function() {
    self.opts.cache._setPath([self._prefix], { });
  };
}

function statEqual(actual, expected) {
  if(!actual || !expected) {
    return false;
  }

  var a = (actual.mtime instanceof Date ? actual.mtime : new Date(actual.mtime)),
      b = (expected.mtime instanceof Date ? expected.mtime : new Date(expected.mtime));

  return actual.size == expected.size && a.getTime() == b.getTime();
}

CacheFile.prototype.data = function(key, value) {
  this.validate();
  if(typeof value === 'undefined') {
    return this.getData(key);
  }
  // set: validation result does not matter, we need to update the metadata in any case
  this.setData(key, value);
  return;
};

CacheFile.prototype.path = function(key, value) {
  this.validate();
  if(typeof value === 'undefined') {
    return this.getPath(key);
  }
  // set: validation result does not matter, we need to update the metadata in any case
  this.setPath(key, value);
  return;
};

// only reads are validated
// validation is only run once every n milliseconds (default: 1)
CacheFile.prototype.validate = function() {
  var self = this,
      expected = this.getExpected();

  var actual = this._getActual(),
      isChanged = this._compare(actual, expected);

  if(isChanged) {
    // invalidate remaining values
    this.opts.cache._unlinkAssociatedFiles(this._prefix);
    // remove from cache meta
    this.clearMetadata();
    // update expected value
    this.setExpected(actual);
  }
  return !isChanged;
};

CacheFile.prototype._getActual = function() {
  if(this.opts.method == 'stat') {
    // check this.opts.cache.mode
    var cache = this.opts.cache,
        useCache = (cache.mode == 'transactional' ? true : false),
        stat;
    try {
      if(useCache) {
        if(!cache.fsStatCache[this.opts.path]) {
          cache.fsStatCache[this.opts.path] = fs.statSync(this.opts.path);
        }
        stat = cache.fsStatCache[this.opts.path];
      } else {
        stat = fs.statSync(this.opts.path);
      }
    } catch (e) {
      // file may not exist
      return { size: 0, mtime: 0 };
    }
    return { size: stat.size, mtime: parseInt(stat.mtime.getTime(), 10) };
  } else {
    return CacheFile._hash(this.opts.method, fs.readFileSync(this.opts.path));
  }
};

CacheFile.prototype.sig = function() {
  var actual = this._getActual(),
      hash;
  if (this.opts.method != 'stat') {
    return actual;
  }
  hash = (actual.mtime instanceof Date ? actual.mtime : new Date(actual.mtime)).getTime() +
        '-' + actual.size;
  return hash;
};

CacheFile.prototype._compare = function(actual, expected) {
  return (this.opts.method == 'stat' ? !statEqual(actual, expected) : (expected != actual));
};

CacheFile._hash = function(method, str) {
  // method is optional, defaults to md5
  if(arguments.length === 1) {
    str = method;
    method = 'md5';
  }
  return crypto.createHash(method).update(str).digest('hex');
};

module.exports = CacheFile;
