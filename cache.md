# Cache v2 design

- Add ability to look up metadata values other than .path (safely, so that errors thrown are caught)
- Instead of using `new Cache()`, use a mechanism that can ensure that each (cachePath + method + other relevant conf) pair resolves to just one Cache instance

Easier task specification

    var Cache = require('minitask').Cache;

    // a single instance per path+method; commands are scoped by task hash
    var cache = Cache.get({
      path: __dirname + '/cache',
      method: 'stat'
    }).task(Cache.hash(JSON.stringify(taskOptions)));

    var cacheFilePath = cache.lookup(inputFilePath);
    if(!cacheFilePath) {
      outFile = cache.filename();

      // do work here

      // now store it
      fs.writeFile(outFile, data, function(err) {
        if (err) throw err;
        cache.complete(inputFilePath, cacheFilePath);
      });
    } else {
      // read from cache
      fs.readFile(cacheFilePath, function(err, data) {
        if (err) throw err;
        console.log(data);
      });
    }


Use cases:


- look up a cached result file related to a task and a input file (e.g. key is a path)
  - task(...).file(inputPath)
  - task(...).file(inputPath, cacheFilePath)
- look up metadata related to a task (when was this task last run?)
  - task(...).meta(path, [value])
- look up metadata related to a task and a specific file (e.g. cached dependencies)
  - task(...).file(inputPath).meta(path, [value])

- clean up old metadata
