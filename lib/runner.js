var fs = require('fs'),
    Task = require('./task.js'),
    Cache = require('./cache.js');

exports.parallel = function(tasks, opts) {
  var running = 0,
      limit = opts.limit,
      flows = [];

  if(!opts.cachePath || !opts.cacheMethod) {
    throw new Error('Missing required metadata (cachePath and/or cacheMethod)');
    return;
  }

  var cacheOpts = {
    method: opts.cacheMethod,
    cachepath: opts.cachePath
  };

  // Scan through the input; find flows, replace with read from cache task
  tasks = tasks.map(function(task) {
    if(task instanceof Task) {

      // require the following metadata:
      // - .inputFilePath
      // - .taskHash
      if(!task.inputFilePath || !task.taskHash) {
        throw new Error('Missing required metadata (inputFilePath and/or taskHash)');
        return;
      }

      // override the input file name and  description from the task description
      cacheOpts.options = task.taskHash;
      cacheOpts.filepath = task.inputFilePath;

      var cacheFile = Cache.lookup(cacheOpts);
      if(!cacheFile) {
        // create the file in the cache folder
        cacheFile = Cache.filename(cacheOpts);

        console.log('Writing transform', task.taskHash, 'from', task.inputFilePath, 'to', cacheFile);

        // set the flow output to the cache file
        task.output(fs.createWriteStream(cacheFile));
        task.once('done', function() {

          console.log('Completed transform', task.taskHash, 'from', task.inputFilePath, 'to', cacheFile);

          // mark as complete
          Cache.complete(cacheFile, cacheOpts);
        });
        // queue the flow
        flows.push(task);
      } else {
        // Flow.emit "hit" -> since we skipped the task
        task.emit('hit');
      }

      // read result from cache file
      return function(out, done) {
          fs.createReadStream(cacheFile)
            .once('close', done)
            .pipe(out, { end: false});
      };
    }
    return task;
  });


  // Run each flow at specified level of parallelism (into the temp file dir)
  function parallel() {
    while(running < limit && flows.length > 0) {
      var task = flows.shift(),
          outName;
      running++;

      // Flow.emit "miss" -> since we didn't just read it from the cache
      task.emit('miss');

      // console.log('EXEC', task.tasks.map(function(t) { return t.toString(); } ));

      task.once('done', function() {
        running--;
        if(flows.length > 0) {
          // avoid issues caused by deep nesting
          process.nextTick(parallel);
        } else if(running == 0) {
          done();
        }
      }).exec();
    }
  }

  if(flows.length === 0) {
    done();
  } else {
    parallel();
  }

  function done() {
    var ranDone = false;
    // Once all the flows have run, run each the fn(out) in the order specified
    // streaming the flow task outputs in the correct order to produce the final file.
    if(tasks.length > 0) {
      series(tasks.map(function(task) {
        return function(onDone) {
          // from fn(done) => fn(out, done)
          return task(opts.output, onDone);
        };
      }), function() {
        function doneFn() {
          if(!ranDone && opts.onDone) {
            ranDone = true;
            opts.onDone();
          }
        }
        // e.g. process.stdout
        if(opts.end !== false) {
          opts.output.end();
          opts.output.once('close', doneFn);
          opts.output.once('finish', doneFn);
        } else {
          doneFn();
        }
      });
    } else if(opts.onDone) {
      opts.onDone();
    }
  }
};

function series(callbacks, last) {
  var results = [];
  function next() {
    var callback = callbacks.shift();
    if(callback) {
      callback(next);
    } else {
      last();
    }
  }
  next();
}
