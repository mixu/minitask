var fs = require('fs'),
    assert = require('assert'),
    Cache = require('minitask').Cache;

exports['cache tests'] = {

  'instance() returns the same instance for the same path/method combo': function() {
    assert.strictEqual(
      Cache.instance({ path: __dirname + '/tmp', method: 'stat' }),
      Cache.instance({ path: __dirname + '/./tmp/../tmp/', method: 'stat' })
    );
  },

  'can store metadata at the root': function() {
    var cache = Cache.instance({ path: __dirname + '/tmp', method: 'stat' }),
        key = Cache.hash(JSON.stringify({ test: new Date() })),
        value = cache.data(key);
    // get
    assert.equal(typeof value, 'undefined');
    // set
    cache.data(key, { foo: 'bar' });
    assert.deepEqual(cache.data(key), { foo: 'bar' });
  },

  'can store metadata about a file': function() {
    var cache = Cache.instance({ path: __dirname + '/tmp', method: 'stat' }),
        key = 'dependencies',
        value = cache.file(__dirname+'/fixtures/bar.txt').data(key);
    // get
    assert.equal(typeof value, 'undefined');
    // set
    cache.data(key, { abc: 'def' });
    assert.deepEqual(cache.data(key), { abc: 'def' });
  },



  'can store the result of a computation': function(done) {
    var cachePath = __dirname + '/tmp',
        inputFilePath = __dirname+'/fixtures/bar.txt',
        cache = Cache.instance({ path: cachePath, method: 'stat' }),
        taskHash = Cache.hash(JSON.stringify({ test: new Date() })),
        cacheFilePath = cache.file(inputFilePath).path(taskHash);

    assert.equal(typeof cacheFilePath, 'undefined');

    var outFile = cache.filepath();

    // do work and store it
    fs.writeFile(outFile, 'hello world', function(err) {
      if (err) throw err;
      cache.file(inputFilePath).path(taskHash, outFile);
      // read from cache
      cacheFilePath = cache.file(inputFilePath).path(taskHash);
      assert.equal(cacheFilePath, outFile);
      assert.equal(cacheFilePath.substr(0, cachePath.length), cachePath);
      done();
    });
  },

  'using stat, when the underlying file changes, the stored items are invalidated': function() {
    // should emit "outdated"
  },

  'using md5, when the underlying file changes, the stored items are invalidated': function() {
    // should emit "outdated"
  },

/*
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
*/
};


// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
