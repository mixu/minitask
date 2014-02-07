var fs = require('fs'),
    path = require('path'),
    log = require('minilog')('files');

function List() {
  this._paths = [];
  this.excludeFn = null;
  this.seen = null;
  this.files = null;
}

List.prototype.exclude = function(arr) {
  if(!arr) {
    this.excludeFn = null;
  } else {
    this.excludeFn = (Array.isArray(arr) ? arr : [ arr ]);
  }
  return this;
};

List.prototype.find = function(fn) {
  this._findMore = fn;
  return this;
};

List.prototype.add = function(filepath) {
  var self = this;
  if (!filepath) return this;
  if (Array.isArray(filepath)) {
    filepath.forEach(function(filepath) {
      self.add(filepath);
    });
    return this;
  }
  if (this._paths.indexOf(filepath) == -1) {
    this._paths.push(filepath);
  }
  return this;
};

List.prototype.sort = function() {
  this.files.sort(function(a, b) { return a.name.localeCompare(b.name); });
};

List.prototype._findMore = function(filepath, stat) {
  if (stat.isDirectory()) {
    var basepath = filepath + (filepath[filepath.length - 1] !== path.sep ? path.sep : '');
    return fs.readdirSync(basepath).map(function(f) {
      return basepath + f;
    });
  }
  return [];
};

List.prototype._exec = function(filepath, onDone) {
  var self = this,
      filepath = path.normalize(filepath),
      completed = 0,
      expected,
      stat;

  // skip files that have been seen: this can occur if the _findMore code
  // does something more interesting than depth-first-search (ex. finds dependencies of a file)
  if(this.seen[filepath]) {
    return onDone && onDone();
  }
  this.seen[filepath] = true;

  try {
    stat = fs.statSync(filepath);
  } catch (e) {
    // ENOENT can occur when stat'ing a symlink to a nonexistent location
    // we want to traverse symlinks in general but ignore these issues
    if (e.code != 'ENOENT') {
      return onDone && onDone(err);
    } else {
      log.error('File not found:', filepath);
      return onDone && onDone();
    }
  }
  // exclusions
  var isExcluded = self.excludeFn && self.excludeFn.some(function(callback) {
    return callback(filepath, stat);
  });

  if(isExcluded) {
    log.info('Excluded path from traversal: ', filepath);;
    return onDone && onDone();
  } else {
    self.files.push({ name: filepath, stat: stat });
  }

  var queue = this._findMore(filepath, stat);
  queue = queue.filter(function(filepath) {
    return !self.seen[filepath];
  });

  if(queue.length > 0) {
    expected = queue.length;
    // call exec
    queue.forEach(function(f) {
      // avoid call stack issues
      process.nextTick(function() {
        self._exec(f, function() {
          completed++;
          if(completed == expected) {
            onDone && onDone();
          }
        });
      });
    });
  } else {
    // call onDone
    onDone && onDone();
  }
};

List.prototype.exec = function(onDone) {
  var self = this,
      completed = 0,
      expected = this._paths.length;

  this.files = [];
  this.seen = {};

  this._paths.forEach(function(filepath) {
    self._exec(filepath, function(err) {
      if (err) {
        return onDone(err);
      }
      completed++;
      if(completed == expected) {
        // reset accumulator
        var files = self.files;
        delete self.files;
        delete self.seen;
        onDone && onDone(null, files);
      }
    });
  });
};

module.exports = List;
