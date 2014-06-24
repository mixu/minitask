# Cache v2 design

## Cache options

    Cache.instance({
      path: 'path to cache location', // directory where to store the cached results and metadata
      method: 'stat' // one of: `stat` | `md5` | `sha1` | `sha256` | `sha512`
    });

## Cache methods

### `Cache.instance()`

The cache is file-oriented. The basic assumption is that if the underlying file changes, then all the results and metadata are invalidated.

    var cache = Cache.instance({ ... cache location and method ... });

### `instance.file()`

`.file` ensures that each particular location/method combo resolves to just one Cache instance.

The second level of the cache is always a file. Ideally, a task contains all the parameters that were used to generate any results associated with it.

    cache.file(inputPath)

Where inputPath is some file that is used as an input to produce some result or metadata.

### `instance.file().data()`

Each file can have metadata associated with it:

    cache.file('...').data(key, [value])

This metadata is valid for as long as the file does not change. Note: it is a good idea to include as much metadata as possible into the key, including things like the package.json version of the code that generated the data and so on. This ensures that things will be invalidated when the actual processing code changes. You can use `Task.hash` to hash the key as shown in the examples.

### `instance.file().path()`

Each file can also have file paths associated with it:

    cache.file('...').path(taskStr, [path])

Note that result files with paths inside the cache (e.g. generated via `cache.filepath()`) are automatically deleted when the input file changes.

### `instance.file().sig()`

`.sig()` returns the cache signature for the file. For `stat`, this is the file size and date modified concatenated into a string. For `md5` and other methods, this is the actual full hash.

### `instance.data()`

For generic metadata shared across all entries in a particular cache location, you can use:

    cache.data(key, [value])

## Reducing the number of fs operations

A long running operation may need a fairly large number of repetitive operations.

By default, all fs operations are performed immediately, but you can switch the cache into a mode which reduces the number of fs.stat and fs.write calls, so that each file is checked at most once with fs.stat and the cache metadata is only persisted to disk at the end of the operation.

To do this, call `cache.begin()` when you start and `cache.end()` when the operation is complete.

## Supporting methods

- `Cache.hash(str)` returns a hashed version of a string.
- `cache.filepath()` returns a path to a random file that's inside the cache. Note: called on instance.

- Add ability to look up metadata values other than .path (safely, so that errors thrown are caught)

### Example: store a task result file in the cache and reuse it if available

E.g. store the result of a computation

    var Cache = require('minitask').Cache;

    var cache = Cache.instance({
      path: __dirname + '/cache',
      method: 'stat'
    });

    var taskHash = Cache.hash(JSON.stringify(taskOptions)),
        cacheFilePath = cache.file(inputFilePath).path(taskHash),
        outFile;

    if(!cacheFilePath) {
      // not cached, so
      outFile = cache.filepath();

      // do work here

      // now store it
      fs.writeFile(outFile, data, function(err) {
        if (err) throw err;
        cache.file(inputFilePath).path(taskHash, outFile);
      });
    } else {
      // read from cache
      fs.readFile(cacheFilePath, function(err, data) {
        if (err) throw err;
        console.log(data);
      });
    }

### Example: store metadata about a task

E.g. when was this task last run?

    var key = Cache.hash(taskOptions),
        value = cache.data(key);

    if(typeof value === 'undefined') {
      cache.data(key, { ... });
    }

### Example: store metadata about a file

E.g. store some computed data structure related to a particular version of a file

    var cache = require('minitask').Cache.instance('...');

    var dependencies = cache.file(inputPath).data('dependencies');

    if(typeof dependencies === 'undefined') {
      // not cached, so calculate metadata ...
      cache.file(inputPath).data('dependencies', { foo: 'bar' });
    }
    // use metadata

