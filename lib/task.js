function isPrimitive(item) {
  return typeof item === 'string' ||
     typeof item === 'boolean' ||
     typeof item === 'number';
}

// A task is a serial execution consisting of:
// 1) sync functions
// 2) async functions
// 3) child processes
// 4) duplex streams
//
// Normally, mixing functions and streams is annoying, since functions operate on
// the whole result while streams operate on partial results. Yet many things - such as
// wrapping a result in a string or calculating some complete transformation - are easiest
// to express as functions.

function Task(tasks) {
  this.tasks = tasks;
  this.i = 0;
  this._input = null;
  this._output = null;
  this.onDone = null;
}

Task.prototype.input = function(input) {
  this._input = input;
  return this;
};

Task.prototype.output = function(output) {
  this._output = output;
  return this;
};

Task.prototype.getTaskType = function(task) {
  if(typeof task === 'function') {
    switch(task.length) {
      case 0:
        return 'pipe-fn';
      case 1:
        return 'sync';
      case 2:
        return 'async';
    }
  } else if(typeof task === 'object') {
    if(task.stdin && task.stdout) {
      return 'pipe';
    } else {
      return 'pipe';
    }
  }
};

Task.prototype._next = function(err, blob) {
  var self = this,
      current = this.tasks[0],
      next = this.tasks[1],
      result, stream;

  var firstStream,
      lastStream;

  if(this.tasks.length == 0) {
    return;
  }

  // if the input is a pipe
  if(this.getTaskType(current) === 'pipe') {
    firstStream = lastStream = current;
  }

  while(this.getTaskType(current) === 'pipe' && this.getTaskType(next) === 'pipe') {
    console.log('pipe chain');//, current.toString(), next.toString());
    // if the input is a pipe, and the next task is a pipe
    // then chain .pipe() until
    // 1) you run out of things (full pipe)
    // 2) you encounter something that's not a pipe

    // instantiate the stream
    stream = next;

    // 1a) an object with stdout and stdin properties (child_process)
    // 1b) an object with a pipe method
    var input = (current.stdout ? current.stdout : current),
        output = (stream.stdin ? stream.stdin : stream);

    input.pipe(output);

    this.tasks.shift();
    current = stream;
    next = this.tasks[1];
    lastStream = current;

    console.log('pipe end:', this.getTaskType(current), this.getTaskType(next));
  }

  if(firstStream && lastStream &&
    this.tasks.length > 0 &&
    (this.getTaskType(this.tasks[1]) === 'sync' ||
    this.getTaskType(this.tasks[1]) === 'async')) {
    // if the input is a pipe, and the next task is a fn
    // then set a listener on the input's "data" and "end" events
    // when the full output is available, then invoke the next task
    //
    // 1) function() { return obj; }
    // 1a) an object with stdout and stdin properties (child_process)
    // 1b) an object with a pipe method

    var stdin = (firstStream.stdin ? firstStream.stdin : firstStream),
        stdout = (lastStream.stdout ? lastStream.stdout : lastStream);
    console.log('stream w/pipe');

    result = '';
    stdout.on('data', function(chunk) {
      result += chunk;
    });
    stdout.on('end', function() {
      self.tasks.shift();
      self._next(null, result);
    });
    stdin.write(blob);
    stdin.end();
    return;
  }

  if(this.getTaskType(current) === 'sync' || this.getTaskType(current) === 'async') {
    // if the input is a task, then run it and return back
    if(current.length == 1) {
      console.log('sync task');
      // 2) function(input) { return sync; }
      result = current(blob);
      this.tasks.shift();
      this._next(null, result);
      return;
    } else if(current.length == 2) {
      console.log('async task');
      // 3) function(input, done) { ... }
      current(blob, function(err, blob) {
        self.tasks.shift();
        self._next(err, blob);
      });
      return;
    }
  }

  console.log('NOTHING MATCHED!');
}

Task.prototype.exec = function() {
  var self = this;

  // Push a fake last task since the stack needs at least two items
  this.tasks.push(function(result) {
    // Output can be:
    if(typeof self._output === 'function') {
      // 1) a function
      self._output(result);
    }
  });

  // instantiate all streams
  this.tasks = this.tasks.map(function(task) {
    if(typeof task === 'function' && task.length === 0) {
      return task();
    }
    return task;
  });

  var types = this.tasks.map(function(task) {
    return self.getTaskType(task);
  });

  console.log(types);





  // The first and last items are handled specially
  // TODO: convert the first item into a stream

  // Specifically, you probably don't want to call .end() on the last item,
  // if it is reused (like process.stdout is)



  if(isPrimitive(this._input)) {
    // convert to "sync function"
    this._next(null, this._input);
  } else {
    throw new Error('Unknown input: ' + this._input);
  }

  return this;
};

module.exports = Task;
