var fs = require('fs'),
    assert = require('assert'),
    Cache = require('minitask').Cache;

var cachePath = __dirname + '/tmp';

exports['cache tests'] = {

  'instance() returns the same instance for the same path/method combo': function() {
    assert.strictEqual(
      Cache.instance({ path: cachePath, method: 'stat' }),
      Cache.instance({ path: __dirname + '/./tmp/../tmp/', method: 'stat' })
    );
  },

  'can store metadata at the root': function() {
    var cache = Cache.instance({ path: cachePath, method: 'stat' }),
        key = Cache.hash(JSON.stringify({ test: new Date() })),
        value = cache.data(key);
    // get
    assert.equal(typeof value, 'undefined');
    // set
    cache.data(key, { foo: 'bar' });
    assert.deepEqual(cache.data(key), { foo: 'bar' });
  },

  'can store metadata about a file': function() {
    var cache = Cache.instance({ path: cachePath, method: 'stat' }),
        key = 'dependencies',
        value = cache.file(__dirname+'/fixtures/bar.txt').data(key);
    // get
    assert.equal(typeof value, 'undefined');
    // set
    cache.data(key, { abc: 'def' });
    assert.deepEqual(cache.data(key), { abc: 'def' });
  },

  'can store the result of a computation': function(done) {
    var inputFilePath = __dirname+'/fixtures/bar.txt',
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
    var cache = Cache.instance({ path: cachePath, method: 'stat' }),
        taskHash = 'test3',
        trackFile = __dirname+'/fixtures/hash.txt';

    fs.writeFileSync(trackFile, 'foo');

    // create the file in the cache folder
    cacheFile = cache.filepath();
    fs.writeFileSync(trackFile, '123');
    // mark as complete
    cache.file(trackFile).path(taskHash, cacheFile);
    assert.equal(cache.file(trackFile).path(taskHash), cacheFile);

    // 1) when the task hash is changed, the lookup is invalidated
    taskHash = 'test4';
    assert.ok(!cache.file(trackFile).path(taskHash));

    // 2) when the file changes => invalidate
    taskHash = 'test3';
    fs.writeFileSync(trackFile, 'foobar');

    var value = cache.file(trackFile).path(taskHash);
    assert.equal(typeof value, 'undefined');
  },

  'using md5, when the underlying file changes, the stored items are invalidated': function() {
    var cache = Cache.instance({ path: cachePath, method: 'md5' }),
        taskHash = 'test3',
        trackFile = __dirname+'/fixtures/hash2.txt';

    fs.writeFileSync(trackFile, 'foo');

    // create the file in the cache folder
    cacheFile = cache.filepath();
    fs.writeFileSync(trackFile, '123');
    // mark as complete
    cache.file(trackFile).path(taskHash, cacheFile);
    assert.equal(cache.file(trackFile).path(taskHash), cacheFile);

    // 1) when the task hash is changed, the lookup is invalidated
    taskHash = 'test4';
    assert.ok(!cache.file(trackFile).path(taskHash));

    // 2) when the file changes => invalidate
    taskHash = 'test3';
    fs.writeFileSync(trackFile, 'foobar');

    var value = cache.file(trackFile).path(taskHash);
    assert.equal(typeof value, 'undefined');
  },

/*
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
