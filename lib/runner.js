var fs = require('fs'),
    Task = require('./task.js'),
    Cache = require('./cache.js');

exports.parallel = function(tasks, opts) {
  var running = 0,
      limit = opts.limit,
      flows = [];

  var cacheOpts = {
    method: 'stat',
    cachepath: __dirname + '/../test/cache/'
  };

  // Scan through the input; find flows, replace with read from cache task
  tasks = tasks.map(function(task) {
    if(task instanceof Task) {
      var flowDescription = Math.random().toString(36).substring(2);

      // override the input file name and  description from the task description
      cacheOpts.options = flowDescription;
      cacheOpts.filepath = __dirname + '/../test/fixtures/bar.txt';

      var cacheFile = Cache.lookup(cacheOpts);
      if(!cacheFile) {
        // create the file in the cache folder
        cacheFile = Cache.filename(cacheOpts);
        // set the flow output to the cache file
        task.output(fs.createWriteStream(cacheFile));
        // HACK: until the task becomes a real eventemitter
        task.onDoneFn = function() {
          // mark as complete
          Cache.complete(cacheFile, cacheOpts);
        };
        // queue the flow
        flows.push(task);
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
      task.exec(function() {
        // HACK: run onDoneFn
        if(task.onDoneFn) {
          task.onDoneFn();
        }

        running--;
        if(flows.length > 0) {
          // avoid issues caused by deep nesting
          process.nextTick(parallel);
        } else if(running == 0) {
          done();
        }
      });
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
        if(!opts.end == false) {
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
