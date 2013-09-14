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

var debugIdentities = [];

function debugId(obj) {
  var index = debugIdentities.indexOf(obj);
  if(index != -1) return index;
  debugIdentities.push(obj);
  return debugIdentities.length - 1;
}


function Task(tasks) {
  // ensure that this.tasks is it's own array instance;
  // this allows the same externally provided task array instance
  // to be reused without modifications done in one run affecting another (c.f. test runner)
  this.tasks = [].concat(tasks);
  this.i = 0;
  this._input = null;
  this._output = null;
  this.onDone = null;
  this.inputPaused = true;
}

Task.prototype.input = function(input) {
  if(typeof input.pause === 'function') {
    input.pause();
  }
  this._input = input;
  return this;
};

Task.prototype.output = function(output) {
  this._output = output;
  return this;
};

Task.prototype.hasOutput = function() {
  return !!this._output;
}

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
  } else if(typeof task === 'object' && task != null) {
    if(task.stdin && task.stdout) {
      return 'pipe';
    } else {
      return 'pipe';
    }
  }
  return 'undefined';
};

Task.prototype._next = function(err, blob, onDone) {
  var self = this,
      current = this.tasks[0],
      next = this.tasks[1],
      result, stream;

  var firstStream,
      lastStream;

  if(this.tasks.length == 0) {
    if(onDone) {
      onDone();
    }
    return;
  }

  // if the input is a pipe
  if(this.getTaskType(current) === 'pipe') {
    firstStream = lastStream = current;
  }

  // [pipe] => [pipe]
  while(this.getTaskType(current) === 'pipe' && this.getTaskType(next) === 'pipe') {
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

    console.log('pipe to pipe:', debugId(current), '->', debugId(stream) );

    input.pipe(output);

    this.tasks.shift();
    current = stream;
    next = this.tasks[1];
    lastStream = current;

  }

  // [pipe] ... [pipe] => [sync | async]
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
    // console.log('stream w/pipe');

    result = '';
    stdout.on('data', function(chunk) {
      // console.log('stream data', '' + chunk);
      result += chunk;
    });
    // stdout.once('close', function() {
    //   console.log('stream close');
    // });
    stdout.once('error', function(e) {
        throw e;
    });
    stdout.once('end', function(chunk) {
      self.tasks.shift();
      console.log('pipe to buffer:',  debugId(lastStream), '-> result:', JSON.stringify(result));
      self._next(null, result, onDone);
    });
    if(typeof blob === 'undefined' && this.inputPaused) {
      // resume the actual input when the pipe chain ends
      this.inputPaused = false;
      console.log('input resume');
      this._input.resume();
    }
    // Do not call .write and .end on the first task when the input is
    // undefined. This indicates that the input was a stream.
    if(typeof blob !== 'undefined') {
      console.log('in write', blob);
      stdin.write(blob);
      stdin.end();
    } else {
      console.log('blob is empty');
    }
    return;
  }

  // [sync | async] => ...
  if(this.getTaskType(current) === 'sync' || this.getTaskType(current) === 'async') {
    // if the input is a task, then run it and return back
    if(current.length == 1) {
      console.log('sync processing:', JSON.stringify(blob));
      // 2) function(input) { return sync; }
      result = current(blob);
      this.tasks.shift();
      this._next(null, result, onDone);
      return;
    } else if(current.length == 2) {
      console.log('sync processing:', JSON.stringify(blob));
      // 3) function(input, done) { ... }
      current(blob, function(err, blob) {
        self.tasks.shift();
        self._next(err, blob, onDone);
      });
      return;
    }
  }

  // last item is [pipe]
  if(this.getTaskType(current) == 'pipe' && this.getTaskType(next) == 'undefined') {
    // write the output
    var stdin = (current.stdin ? current.stdin : current),
        stdout = (current.stdout ? current.stdout : current);

    if(typeof blob === 'undefined' && this.inputPaused) {
      // resume the actual input when the pipe chain ends
      this.inputPaused = false;
      console.log('input resume');
      this._input.resume();
    }

    // Specifically, you probably don't want to call .end() on the last item,
    // if it is reused (like process.stdout is)
    if(typeof blob !== 'undefined') {
      console.log('buffer to pipe:', JSON.stringify(blob), '->', debugId(current));
      stdin.write(blob);
      stdin.end();
    } else {
      console.log('blob is empty');
    }

    // 0.8.x: "close"
    // 0.10.x: "finish"
    var emittedDone = false;
    function emitDone() {
      if(!emittedDone) {
        emittedDone = true;
        onDone();
      }
    }
    if(onDone) {
      stdout.once('close', emitDone);
      stdout.once('finish', emitDone);
    }

    return;
  }

  console.log('NOTHING MATCHED!', this.getTaskType(current), this.getTaskType(next));
}

Task.prototype.exec = function(onDone) {
  var self = this;

  // Caching:
  // 1) query the cache for whether a cached output
  // exists for the current workflow
  // 2) if such a file exists, clear the tasks and
  // push a file read stream instead, then continue normally


  // Output can be:
  if(typeof self._output === 'function') {
    console.log('Output is a function.');
    // 1) a function
    this.tasks.push(function(result) {
      self._output(result);
    });
  } else if(typeof self._output === 'object') {
    // 2) a stream
    console.log('Output is a stream.');
    this.tasks.push(self._output);
  } else {
    throw new Error('Unknown output: ' + this._output);
  }

  // instantiate all streams
  this.tasks = this.tasks.map(function(task) {
    if(typeof task === 'function' && task.length === 0) {
      return task();
    }
    return task;
  });

  function logTypes() {
     console.log(self.tasks.map(function(task) {
        return self.getTaskType(task);
      }));
    }

  // The first and last items are handled specially

  if(isPrimitive(this._input)) {
    console.log('Input is a string.');
    // convert to "sync function"
    logTypes();
    this._next(null, this._input, onDone);
  } else if(typeof this._input === 'object') {
    console.log('Input is a stream.');
    // convert to "pipe function"
    this.tasks.unshift(this._input);
    logTypes();
    this._next(null, undefined, onDone);
  } else {
    throw new Error('Unknown input: ' + this._input);
  }

  return this;
};

module.exports = Task;
