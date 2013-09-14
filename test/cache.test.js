var fs = require('fs'),
    assert = require('assert'),
    Cache = require('minitask').Cache;

exports['cache tests'] = {

  beforeEach: function() {
    var opts = {
      cachepath: __dirname+'/cache',
      filepath: __dirname+'/fixtures/bar.txt'
    };
    Cache.clear(opts);
  },

  'can look up a cached item by fs.stat': function() {
    var opts = {
      cachepath: __dirname+'/cache',
      filepath: __dirname+'/fixtures/bar.txt'
    };
    assert.ok(!Cache.lookup(opts));

    // create the file in the cache folder
    cacheFile = Cache.filename(opts);
    fs.writeFileSync(cacheFile, 'foo');
    // mark as complete
    Cache.complete(cacheFile, opts);
    assert.ok(Cache.lookup(opts));
  },

  'can look up a cached item by md5': function() {
    var opts = {
      cachepath: __dirname+'/cache',
      filepath: __dirname+'/fixtures/hash.txt',
      method: 'md5'
    };
    fs.writeFileSync(__dirname+'/fixtures/hash.txt', 'first');

    assert.ok(!Cache.lookup(opts));
    // create the file in the cache folder
    cacheFile = Cache.filename(opts);
    fs.writeFileSync(cacheFile, 'foo');
    // mark as complete
    Cache.complete(cacheFile, opts);
    assert.ok(Cache.lookup(opts));

    fs.writeFileSync(__dirname+'/fixtures/hash.txt', 'second');
    assert.ok(!Cache.lookup(opts));
  },

  'when the execution result does not match, it is not reused': function() {
    var opts = {
      cachepath: __dirname+'/cache',
      filepath: __dirname+'/fixtures/bar.txt',
      options: {
        foo: 'foo',
        bar: 'bar'
      }
    };

    // create the file in the cache folder
    cacheFile = Cache.filename(opts);
    fs.writeFileSync(cacheFile, 'foo');
    // mark as complete
    Cache.complete(cacheFile, opts);
    assert.ok(Cache.lookup(opts));

    // order of definition should not matter
    opts.options = {
      bar: 'bar',
      foo: 'foo'
    };
    assert.ok(Cache.lookup(opts));

    // when options are changed, the lookup is invalidated
    opts.options = {
      foo: 'bar',
      bar: 'foo'
    };
    assert.ok(!Cache.lookup(opts));
  }

};


// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
