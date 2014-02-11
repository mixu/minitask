var fs = require('fs'),
    path = require('path'),
    log = require('minilog')('files');

var TASK_LIMIT = 12;

function List() {
  this._paths = [];
  this._exclude = null;
  this.seen = null;
  this.files = null;
  this._basepath = process.cwd();

  this.running = 0;
}

List.prototype.exclude = function(arr) {
  if(!arr) {
    this._exclude = null;
  } else {
    this._exclude = (Array.isArray(arr) ? arr : [ arr ]);
  }
  return this;
};

List.prototype.basepath = function(p) {
  this._basepath = p;
  return this;
};

List.prototype.find = function(fn) {
  this._find = fn;
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
  if(this._basepath) {
    filepath = path.resolve(this._basepath, filepath);
  }
  if (this._paths.indexOf(filepath) == -1) {
    this._paths.push(filepath);
  }
  return this;
};

List.prototype.sort = function() {
  this.files.sort(function(a, b) { return a.name.localeCompare(b.name); });
};

List.prototype._find = function(filepath, stat, onDone) {
  if (stat.isDirectory()) {
    var basepath = filepath + (filepath[filepath.length - 1] !== path.sep ? path.sep : '');
    return onDone(null, fs.readdirSync(basepath).map(function(f) {
      return basepath + f;
    }));
  }
  return onDone(null, []);
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
  var isExcluded = self._exclude && self._exclude.some(function(callback) {
    return callback(filepath, stat);
  });

  if(isExcluded) {
    log.info('Excluded path from traversal: ', filepath);;
    return onDone && onDone();
  } else {
    self.files.push({ name: filepath, stat: stat });
  }

  this._find(filepath, stat, function(err, queue) {
    queue = queue.filter(function(filepath) {
      return !self.seen[filepath];
    });

    if(queue.length > 0) {
      self.parallel(queue.map(function(item) {
        return function(done) {
          self._exec(item, done);
        };
      }), onDone);
    } else {
      // call onDone
      onDone && onDone();
    }
  });
};

// run tasks at parallelism (limit)
// note that this is applied across all
List.prototype.parallel = function(tasks, onDone) {
  var self = this;
  this.tasks = this.tasks.concat(tasks);

  function next() {
    self.running--;
    if(self.tasks.length == 0) {
      return onDone();
    }
    while(self.running < TASK_LIMIT && self.tasks.length > 0) {
      var task = self.tasks.shift();
      self.running++;
      task(next);
    }
  }
  self.running++;
  next();
};

List.prototype.exec = function(onDone) {
  var self = this,
      completed = 0,
      expected = this._paths.length;

  this.files = [];
  this.seen = {};
  // reset running count
  this.running = 0;
  this.tasks = [];

  if(this._paths.length > 0) {
    this.parallel(this._paths.map(function(item) {
      return function(done) {
        self._exec(item, done);
      };
    }), function() {
      // reset accumulator
      var files = self.files;
      delete self.files;
      delete self.seen;
      onDone && onDone(null, files);
    });
  } else {
    onDone && onDone(null);
  }
};

module.exports = List;
