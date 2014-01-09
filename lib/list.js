var fs = require('fs'),
    path = require('path'),
    log = require('minilog')('files');

function List() {
  this.files = [];
}

List.prototype.exclude = function(arr) {
  if(!arr) {
    this.excludeFn = null;
  } else {
    this.excludeFn = (Array.isArray(arr) ? arr : [ arr ]);
  }
};

List.prototype.add = function(filepath) {
  if (!filepath) return this;
  var self = this,
      paths = (Array.isArray(filepath) ? filepath : [filepath]);

  paths.forEach(function(p) {
    var stat;
    p = path.normalize(p); // for windows

    try {
      stat = fs.statSync(p);
    } catch (e) {
      // ENOENT can occur when stat'ing a symlink to a nonexistent location
      // we want to traverse symlinks in general but ignore these issues
      if (e.code != 'ENOENT') {
        throw e;
      } else {
        log.error('File not found:', filepath);
        return;
      }
    }

    if (stat.isDirectory()) {
      // exclusions
      var isExcluded = self.excludeFn && self.excludeFn.some(function(callback) {
        return callback(p);
      });
      if (isExcluded) {
        log.info('Excluded path from traversal: ', p);
        return;
      }

      p += (p[p.length - 1] !== path.sep ? path.sep : '');
      return fs.readdirSync(p).forEach(function(f) {
        self.add(p + f);
      });
    }
    self.files.push({ name: p, stat: stat });
  });
  return this;
};

List.prototype.sort = function() {
  this.files.sort(function(a, b) { return a.name.localeCompare(b.name); });
};

module.exports = List;
