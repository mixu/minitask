var fs = require('fs'),
    crypto = require('crypto'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    assert = require('assert');

function Cache(opts) {
  this.opts = opts;
  this.data = null;
  this.path = opts.path;

  // can either set the path, or set 'appHash'
  if(opts.path) {
    this.metaPath = path.normalize(opts.path + '/meta.json');

    try {
      this.data = (fs.existsSync(this.metaPath) ? require(this.metaPath) : {});
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
  } else if(opts.appHash) {
    // global cache dir, with subdir for this
  } else {
    throw new Error('Must set either the path or the appHash');
  }

  this.validate();
}

Cache.prototype.validate = function() {
  // {
  //   inputFilePath: {
  //     stat: (expected stat meta)
  //     md5: (expected hash meta)
  //
  //     taskResults: {
  //       taskHash: {
  //         path: (path in cache for this task)
  //       }
  //     }
  //   }
  // }
  try {
    var data = this.data,
        topKeys = Object.keys(data);
    assert.ok(Array.isArray(topKeys));

    topKeys.forEach(function(key) {
      var file = data[key];
      assert.ok(file.taskResults);
      assert.ok(Array.isArray(Object.keys(file.taskResults)));
      Object.keys(file.taskResults).forEach(function(key) {
        assert.equal(typeof file.taskResults[key]['path'], 'string');
      });
      assert.ok(file.stat);
      assert.ok(Array.isArray(Object.keys(file.stat)));
      [
       'size', 'mtime'
      ].forEach(function(key) {
        assert.ok(!!file.stat[key]);
      });
    });
  } catch(e) {
    console.error('');
    console.error('ERROR: The cache index file "' + this.metaPath + '" is in an unexpected or outdated format.');
    console.error('To fix this issue, you should delete the folder "' +
      path.dirname(this.metaPath) + '" to clear the cache.');
    throw e;
  }
};

Cache.prototype.save = function() {
  // just in case
  if(!fs.existsSync(this.opts.path)) {
    mkdirp.sync(this.opts.path);
  }
  fs.writeFileSync(this.metaPath, JSON.stringify(this.data, null, 2));
};

// invalidates all the cached items for the given inputFilePath
Cache.prototype.junk = function(inputFilePath) {
  var self = this;
  inputFilePath = path.normalize(inputFilePath);
  if(!this.data[inputFilePath]) {
    return; // nothing to do
  }
  // for each .taskResults
  Object.keys(this.data[inputFilePath].taskResults).forEach(function(taskHash) {
    // .taskResults[hash] = { path: '...' }
    var cacheFile = self.data[inputFilePath].taskResults[taskHash].path;
    if(fs.existsSync(cacheFile)) {
      fs.unlink(cacheFile);
    }
  });
  delete this.data[inputFilePath];
};

Cache.prototype.clear = function() {
  var self = this;
  // delete any lingering files
  Object.keys(this.data).forEach(function(inputFilePath) {
    self.junk(inputFilePath);
  });
  this.data = {};
  this.save();
};

Cache.prototype.filename = function() {
  var cacheName;
  // generate a new file name
  do {
    cacheName = this.path + '/' + Math.random().toString(36).substring(2);
  } while(fs.existsSync(cacheName));
  return cacheName;
};

Cache.prototype.complete = function(inputFilePath, taskHash, cacheFilePath) {
  if(arguments.length < 3) {
    throw new Error('Invalid call to Cache.complete()');
  }

  var method = this.opts.method || 'stat';

  if(!this.data[inputFilePath]) {
    this.data[inputFilePath] = { taskResults: {} };
  }
  if(!this.data[inputFilePath].taskResults) {
    this.data[inputFilePath].taskResults = {};
  }

  if(method == 'stat') {
    this.data[inputFilePath].stat = fs.statSync(inputFilePath);
  } else {
    this.data[inputFilePath][method] = Cache.hash(method, fs.readFileSync(inputFilePath));
  }
  this.data[inputFilePath].taskResults[taskHash] = { path: cacheFilePath };
  this.save();
};

function statEqual(actual, expected) {
  if(!actual || !expected) {
    return false;
  }

  var a = (actual.mtime instanceof Date ? actual.mtime : new Date(actual.mtime)),
      b = (expected.mtime instanceof Date ? expected.mtime : new Date(expected.mtime));

  return actual.size == expected.size && a.getTime() == b.getTime();
}

Cache.prototype.lookup = function(inputFilePath, taskHash) {
  var method = this.opts.method || 'stat',
      cacheMeta = this.data[inputFilePath];
  // if:
  // 1) the input file file path or
  // 2) the cache metadata for the file or
  // 3) the input task hash
  // is missing no cached values can be fetched
  if(!inputFilePath || !cacheMeta || !taskHash) {
    return false;
  }

  var inputFileChanged = true; // assume changed
  // has the file changed?
  // console.log('Cache lookup!', method, cacheMeta);

  if(method == 'stat') {
    inputFileChanged = !statEqual(fs.statSync(inputFilePath), cacheMeta.stat);
  } else if(cacheMeta[method]) {
    inputFileChanged = (cacheMeta[method] != Cache.hash(method, fs.readFileSync(inputFilePath)));
  }

  // if the input file changes, then all the cached values are invalidated
  if(inputFileChanged) {
    this.junk(inputFilePath);
    return false;
  }

  // now, search for a cached file that corresponds to the current task hash
  if(!cacheMeta.taskResults || !cacheMeta.taskResults[taskHash] || !cacheMeta.taskResults[taskHash].path) {
    return false;
  }
  return cacheMeta.taskResults[taskHash].path;
};

Cache.hash = Cache.prototype.hash = function(method, str) {
  // method is optional, defaults to md5
  if(arguments.length === 1) {
    str = method;
    method = 'md5';
  }
  return crypto.createHash(method).update(str).digest('hex');
};

module.exports = Cache;

