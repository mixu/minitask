# Cache v2 design

## Cache options

    Cache.get({
      path: 'path to cache location',
      method: 'stat' // stat | crypto algo
    });

## Cache methods

The cache is file-oriented. The basic assumption is that if the underlying file changes, then all the results and metadata are invalidated.

    var cache = Cache.get({ ... cache location and method ... });

`.get` ensures that each particular location/method combo resolves to just one Cache instance.

The second level of the cache is always a file. Ideally, a task contains all the parameters that were used to generate any results associated with it.

    cache.file(inputPath)

Each file can have metadata associated with it:

    cache.file('...').data(key, [value])

This metadata is valid for as long as the file does not change.

Each file can also have file paths associated with it:

    cache.file('...').path(taskStr, [path])

For generic metadata shared across all entries in a particular cache location, you can use:

    cache.data(key, [value])

## Supporting methods

- `Cache.on('outdated', function(file) { ... });` emitted when a file is invalidated
  - file-related result files that reside in the cache folder and any metadata is cleaned up on invalidation
- `Cache.hash(str)` returns a hashed version of a string.
- `Cache.filepath()` returns a path to a random file that's inside the cache.
- `Cache.attemptDelete(file)` attempts to delete the file

- Add ability to look up metadata values other than .path (safely, so that errors thrown are caught)

### Example: store a task result file in the cache and reuse it if available

E.g. store the result of a computation

    var Cache = require('minitask').Cache;

    var cache = Cache.get({
      path: __dirname + '/cache',
      method: 'stat'
    });

    var taskHash = Cache.hash(JSON.stringify(taskOptions)),
        cacheFilePath = cache.file(inputFilePath).path(taskHash);

    if(!cacheFilePath) {
      // not cached, so
      outFile = Cache.filepath();

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

    var cache = require('minitask').Cache.get('...');

    var dependencies = cache.file(inputPath).data('dependencies');

    if(typeof dependencies === 'undefined') {
      // not cached, so calculate metadata ...
      cache.file(inputPath).data('dependencies', { foo: 'bar' });
    }
    // use metadata

