var fs = require('fs'),
    assert = require('assert'),
    Cache = require('minitask').Cache;

var cache = null;

exports['cache tests'] = {

  before: function() {
    cache = new Cache({
      path: __dirname+'/cache'
    });
  },

  beforeEach: function() {
    cache.clear();
  },

  'can look up a cached item by fs.stat': function() {
    assert.ok(!cache.lookup(__dirname+'/fixtures/bar.txt', 'simple'));

    // create the file in the cache folder
    cacheFile = cache.filename();
    fs.writeFileSync(cacheFile, 'foo');
    // mark as complete
    cache.complete(__dirname+'/fixtures/bar.txt', 'simple', cacheFile);
    assert.ok(cache.lookup(__dirname+'/fixtures/bar.txt', 'simple'));
  },

  'can look up a cached item by md5': function() {
    cache = new Cache({
      path: __dirname+'/cache',
      method: 'md5'
    });

    fs.writeFileSync(__dirname+'/fixtures/hash.txt', 'first');

    assert.ok(!cache.lookup(__dirname+'/fixtures/hash.txt', 'test2'));
    // create the file in the cache folder
    cacheFile = cache.filename();
    fs.writeFileSync(cacheFile, 'foo');
    // mark as complete
    cache.complete(__dirname+'/fixtures/hash.txt', 'test2', cacheFile);
    assert.ok(cache.lookup(__dirname+'/fixtures/hash.txt', 'test2'));

    // change the input file => invalidate
    fs.writeFileSync(__dirname+'/fixtures/hash.txt', 'second');
    assert.ok(!cache.lookup(__dirname+'/fixtures/hash.txt', 'test2'));
  },

  'when the execution result does not match, it is not reused': function() {
    cache = new Cache({
      path: __dirname+'/cache',
      method: 'stat'
    });

    var taskHash = 'test3';

    // create the file in the cache folder
    cacheFile = cache.filename();
    fs.writeFileSync(cacheFile, 'foo');
    // mark as complete
    cache.complete(__dirname+'/fixtures/hash.txt', taskHash, cacheFile);
    assert.ok(cache.lookup(__dirname+'/fixtures/hash.txt', taskHash));

    // when the task hash is changed, the lookup is invalidated
    taskHash = 'test4';
    assert.ok(!cache.lookup(__dirname+'/fixtures/hash.txt', taskHash));
  },

  'can call Cache.lookup(url)': function() {

  }

};


// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
