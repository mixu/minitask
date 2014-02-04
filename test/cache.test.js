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

  'can clear the cache': function() {
    var cache = Cache.instance({ path: cachePath, method: 'stat' }),
        trackFile = __dirname+'/fixtures/bar.txt',
        cacheFile = cache.filepath();

    fs.writeFileSync(cacheFile, '123');

    cache.data('one', 'hello');
    cache.file(trackFile).path('cleartest', cacheFile);
    cache.file(trackFile).data('three', 'bar');
    cache.clear();

    assert.equal(typeof cache.data('one', 'hello'), 'undefined');
    assert.equal(typeof cache.file(trackFile).path('cleartest', 'foo'), 'undefined');
    assert.equal(typeof cache.file(trackFile).data('three', 'bar'), 'undefined');
    assert.ok(!fs.existsSync(cacheFile));
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
        trackFile = __dirname+'/fixtures/bar.txt',
        value = { abc: 'def' };

    fs.writeFileSync(trackFile, new Date().toString());

    // get
    assert.equal(typeof cache.file(trackFile).data(key), 'undefined');
    // set
    cache.file(trackFile).data(key, value);
    assert.deepEqual(cache.file(trackFile).data(key), { abc: 'def' });
    // invalidate
    fs.writeFileSync(trackFile, '123');
    assert.equal(typeof cache.file(trackFile).data(key), 'undefined');
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
        trackFile = __dirname+'/fixtures/hash.txt',
        otherFile = __dirname+'/fixtures/bar.txt';

    // create the file to track
    fs.writeFileSync(trackFile, 'foo');

    // get a cache result path and perform a computation and write it into the cache file
    cacheFile = cache.filepath();
    fs.writeFileSync(cacheFile, '123');
    // mark as complete
    cache.file(trackFile).path('test3', cacheFile);
    assert.equal(cache.file(trackFile).path('test3'), cacheFile);
    // store otherFile
    cache.file(trackFile).path('other', otherFile);
    assert.equal(cache.file(trackFile).path('other'), otherFile);

    // 1) when the task hash is changed, the lookup is invalidated
    assert.ok(!cache.file(trackFile).path('test4'));

    // 2) when the file changes => invalidate
    fs.writeFileSync(trackFile, 'foobar');

    // should delete the outdated file after the access
    var value = cache.file(trackFile).path('test3');
    assert.ok(!fs.existsSync(cacheFile));
    assert.equal(typeof value, 'undefined');

    // should not delete files outside the cache folder
    value = cache.file(trackFile).path('other');
    assert.ok(fs.existsSync(otherFile));
    assert.equal(typeof cache.file(trackFile).path('other'), 'undefined');
  },

  'using md5, when the underlying file changes, the stored items are invalidated': function() {
    var cache = Cache.instance({ path: cachePath, method: 'md5' }),
        trackFile = __dirname+'/fixtures/hash2.txt',
        otherFile = __dirname+'/fixtures/bar.txt';

    // create the file to track
    fs.writeFileSync(trackFile, 'foo');

    // get a cache result path and perform a computation and write it into the cache file
    cacheFile = cache.filepath();
    fs.writeFileSync(cacheFile, '123');
    // mark as complete
    cache.file(trackFile).path('test3', cacheFile);
    assert.equal(cache.file(trackFile).path('test3'), cacheFile);
    // store otherFile
    cache.file(trackFile).path('other', otherFile);
    assert.equal(cache.file(trackFile).path('other'), otherFile);

    // 1) when the task hash is changed, the lookup is invalidated
    assert.ok(!cache.file(trackFile).path('test4'));

    // 2) when the file changes => invalidate
    fs.writeFileSync(trackFile, 'foobar');

    // should delete the outdated file after the access
    var value = cache.file(trackFile).path('test3');
    assert.ok(!fs.existsSync(cacheFile));
    assert.equal(typeof value, 'undefined');

    // should not delete files outside the cache folder
    value = cache.file(trackFile).path('other');
    assert.ok(fs.existsSync(otherFile));
    assert.equal(typeof cache.file(trackFile).path('other'), 'undefined');
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
