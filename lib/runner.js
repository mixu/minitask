exports.parallel = function(tasks, opts) {
  var onDone = opts.onDone;
  // assume independent tasks
  var running = 0,
      limit = 16;

  function parallel() {
    while(running < limit && tasks.length > 0) {
      var task = tasks.shift();
      running++;
      task.exec(function() {
        running--;
        if(tasks.length > 0) {
          // avoid issues caused by deep nesting
          process.nextTick(parallel);
        } else if(running == 0) {
          onDone();
        }
      });
    }
  }
  parallel();

};
