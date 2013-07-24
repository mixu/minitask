var fs = require('fs'),
    assert = require('assert'),
    cache = require('minitask').cache;

var opt = {
  cachepath: __dirname+'/cache',
  filepath: __dirname+'/fixtures/bar.txt',
  stat: fs.statSync(__dirname+'/fixtures/bar.txt')
};

exports['cache tests'] = {

  beforeEach: function() {
    cache.clear(opt);
  },

  'can look up a cached item by fs.stat': function(done) {
    assert.ok(!cache.lookup(opt));

    // create the file in the cache folder
    var last = cache(opt, [], function() {
      assert.ok(cache.lookup(opt));
      done();
    });
    last.stdout.pipe(process.stdout, { end: false });
  },

  'can store a execution result and reuse it': function(done) {
    var last = cache(opt, [], function() {
      assert.ok(cache.lookup(opt));
      // run a second time
      var second = cache(opt, [
        function() {
          throw new Error('Cache reuse failed!');
        }
      ], function() {
        done();
      });
      second.stdout.pipe(process.stdout, { end: false });
    });
    last.stdout.pipe(process.stdout, { end: false });
  },

  'when the execution result does not match, it is not reused': function(done) {
    opt.options = {
      foo: 'foo',
      bar: 'bar'
    };
    var last = cache(opt, [], function() {
      assert.ok(cache.lookup(opt));
      // order of definition should not matter
      opt.options = {
        bar: 'bar',
        foo: 'foo'
      };
      assert.ok(cache.lookup(opt));
      // when options are changed, the lookup is invalidated
      opt.options = {
        foo: 'bar',
        bar: 'foo'
      };
      assert.ok(!cache.lookup(opt));
      done();
    });
    last.stdout.pipe(process.stdout, { end: false });
  }

};


// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
