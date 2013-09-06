var isNodeTen = (typeof require('stream').Transform != 'undefined'),
    Transform = (isNodeTen? require('stream').Transform : require('readable-stream').Transform);

function WrapCJS(options) {
  Transform.call(this, options);
  this.opts = options || {};
  this.first = true;
  this.buffer = '';
}

WrapCJS.prototype = Object.create(Transform.prototype, { constructor: { value: WrapCJS }});

WrapCJS.prototype.writeFirst = function() {
  this.push('QQ');
  this.first = false;
};

WrapCJS.prototype._transform = function(chunk, encoding, done) {
  if(this.first) {
    this.writeFirst();
  }
  this.buffer += chunk;
  done();
};

WrapCJS.prototype._flush = function(done) {
  // for 0-length files, only _flush is called
  if(this.first) {
    this.writeFirst();
    this.push('QQ');
  } else {
    this.push(this.buffer.trim() + 'QQ');
  }
  done();
};

module.exports = WrapCJS;
