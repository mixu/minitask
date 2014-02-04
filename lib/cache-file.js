var fs = require('fs'),
    path = require('path'),
    crypto = require('crypto');

function CacheFile(opts) {
  if(!opts.path || !opts.method) {
    throw new Error('Must set the input file path and method');
  }

  this.opts = opts;
  this._lastValidate = 0;
  this._prefix = path.normalize(opts.path);
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
  if(typeof value === 'undefined') {
    return this._get([ 'data', key ]);
  }
  return this._set([ 'data', key ], value);
};

CacheFile.prototype.path = function(key, value) {
  if(typeof value === 'undefined') {
    return this._get([ 'path', key ]);
  }
  return this._set([ 'path', key ], value);
};

CacheFile.prototype._get = function(key) {
  // adds a "filename" prefix
  // get: quick get if valid, else run validation
  if(this._isValid() || this.validate()) {
    return this.opts.cache._get([ this._prefix ].concat( key ));
  }
  return undefined;
};

CacheFile.prototype._set = function(key, value) {
  // adds a "filename" prefix
  // set: quick set if valid, else update metadata
  if(this._isValid() || this.validate()) {
    this.opts.cache._set([ this._prefix ].concat( key ), value);
    return;
  }
  // update metadata
  this._rehash();
  this.opts.cache._set([ this._prefix ].concat( key ), value);
};

// only reads are validated
// validation is only run once every n milliseconds (default: 1)
CacheFile.prototype.validate = function() {
  var self = this;
  function get(key) {
    return self.opts.cache._get([ self._prefix ].concat( key ))
  }

  var method = this.opts.method,
      expected = get([ 'expected', this.opts.method ]);

  // return invalid if: 1) no input file or 2) no expected value in cache
  if(!this.opts.path || !expected) {
    return false;
  }
  var actual = this._getActual(),
      isChanged = this._compare(actual, expected);

  return !isChanged;
};

CacheFile.prototype._isValid = function() {
  return false;
};

CacheFile.prototype._getActual = function() {
  if(this.opts.method == 'stat') {
    return fs.statSync(this.opts.path);
  } else {
    return CacheFile._hash(this.opts.method, fs.readFileSync(this.opts.path));
  }
};

CacheFile.prototype._compare = function(actual, expected) {
  return (this.opts.method == 'stat' ? !statEqual(actual, expected) : (expected != actual));
};

CacheFile.prototype._rehash = function() {
  var self = this,
      actual = this._getActual(),
      expected = this._get([ 'expected', this.opts.method ]),
      isChanged = this._compare(actual, expected);

  // cannot use this._set as it calls this function
  function set(key, value) {
    self.opts.cache._set([ self._prefix ].concat( key ), value);
  }

  if(isChanged) {
    // invalidate remaining values

    /*
    // delete paths
    // for each .taskResults
    Object.keys(this.data[inputFilePath].taskResults).forEach(function(taskHash) {
      // .taskResults[hash] = { path: '...' }
      var cacheFile = self.data[inputFilePath].taskResults[taskHash].path;
      if(fs.existsSync(cacheFile)) {
        fs.unlink(cacheFile);
      }
    });

    */
    // remove from cache meta
    set([ 'path' ], undefined);
    set([ 'data' ], undefined);
    set([ 'expected' ], undefined);


    // update expected value
    set([ 'expected', this.opts.method ], actual);
  }
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
