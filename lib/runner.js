var os = require('os'),
    fs = require('fs');

exports.parallel = function(tasks, opts) {
  var running = 0,
      limit = opts.limit,
      // temp file names
      tempFileNames = [];

  // preprocess tasks
  tasks.forEach(function(task) {
    // if flow.hasOutput is false, then set a temp location
    // and call exec; also save the temp file name since
    // we will need it in the last stage.
    if(!task.hasOutput()) {
      do {
        outName = os.tmpDir() + '/'+ Math.random().toString(36).substring(2);
      } while(fs.existsSync(outName));
      task.output(fs.createWriteStream(outName));
      tempFileNames.push(outName);
    }
  });

  function parallel() {
    while(running < limit && tasks.length > 0) {
      var task = tasks.shift(),
          outName;
      running++;
      task.exec(function() {
        running--;
        if(tasks.length > 0) {
          // avoid issues caused by deep nesting
          process.nextTick(parallel);
        } else if(running == 0) {
          done();
        }
      });
    }
  }

  function done() {
    var ranDone = false;
    // if opts.output is set, and we have tempFileNames
    // then read all the temp files in order and pipe them
    if(opts.output) {
      series(tempFileNames.map(function(fileName) {
        return function(onDone) {
          fs.createReadStream(fileName)
            .once('close', onDone)
            .pipe(opts.output, { end: false });
        };
      }), function() {
        function doneFn() {
          if(!ranDone && opts.onDone) {
            ranDone = true;
            opts.onDone();
          }
        }

        opts.output.end();
        opts.output.once('close', doneFn);
        opts.output.once('finish', doneFn);
      });
    } else if(opts.onDone) {
      opts.onDone();
    }
  }

  parallel();
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
