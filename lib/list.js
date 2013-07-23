var fs = require('fs'),
    path = require('path'),
    log = require('minilog')('files');

function List() {
  this.files = [];
}

List.prototype.add = function(filepath){
  if(!filepath) return this;
  var self = this,
      paths = (Array.isArray(filepath) ? filepath : [ filepath ]);

  paths.forEach(function(p) {
    var stat;
    p = path.normalize(p); // for windows
    try {
      stat = fs.statSync(p);
    } catch(e) {
      // ENOENT can occur when stat'ing a symlink to a nonexistent location
      // we want to traverse symlinks in general but ignore these issues
      if(e.code != 'ENOENT') {
        throw e;
      } else {
        log.error('File not found:', filepath);
        return;
      }
    }

    if (stat.isDirectory()) {
      p += (p[p.length-1] !== path.sep ? path.sep : '');
      return fs.readdirSync(p).forEach(function (f) {
        self.add(p + f);
      });
    }
    self.files.push({ name: p, stat: stat });
  });
  // sort on each add
  self.files.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return this;
};

module.exports = List;
