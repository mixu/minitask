var util = require('util'),
    events = require('events');

function debug() {
  // console.log.apply(console, Array.prototype.slice.apply(arguments));
}

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
  this.inputPaused = true;

  // destroy the file handle on 'hit'
  // as it will otherwise not be consumed properly and hence never closed
  var self = this;
  this.once('hit', function() {
    if (self._input && self._input.destroy) {
      self._input.destroy();
    }
  });
}

util.inherits(Task, events.EventEmitter);

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

Task.prototype._next = function(err, blob) {
  var self = this,
      current = this.tasks[0],
      next = this.tasks[1],
      result, stream;

  var firstStream,
      lastStream;

  if(this.tasks.length == 0) {
    debug('emit: "done"');
    self.emit('done', self);
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


    debug('pipe to pipe:', debugId(input), '->', debugId(output) );
    if(input !== output) {

      input.on('error', function(err) {
        if (err.code != 'EPIPE') {
          console.error('Error in input pipe to pipe:', debugId(input), '->', debugId(output), err);
          console.trace();
        }
      });

      output.on('error', function(err) {
        if (err.code != 'EPIPE') {
          console.error('Error in output pipe to pipe:', debugId(input), '->', debugId(output), err);
          console.log(input);
          console.log(output);
          console.trace();
        }
      });


      input.pipe(output);
    }

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
    debug('stream w/pipe');

    result = '';
    stdout.on('data', function(chunk) {
      debug('stream data', '' + chunk);
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
      debug('pipe to buffer:',  debugId(lastStream), '-> result:', JSON.stringify(result));
      self._next(null, result);
    });
    if(typeof blob === 'undefined' && this.inputPaused) {
      // resume the actual input when the pipe chain ends
      this.inputPaused = false;
      debug('input resume');
      this._input.resume();
    }
    // Do not call .write and .end on the first task when the input is
    // undefined. This indicates that the input was a stream.
    if(typeof blob !== 'undefined') {
      debug('in write', blob);
      stdin.write(blob);
      stdin.end();
    } else {
      debug('blob is empty');
    }
    return;
  }

  // [sync | async] => ...
  if(this.getTaskType(current) === 'sync' || this.getTaskType(current) === 'async') {
    // if the input is a task, then run it and return back
    if(current.length == 1) {
      debug('sync processing:', JSON.stringify(blob));
      // 2) function(input) { return sync; }
      result = current(blob);
      this.tasks.shift();
      this._next(null, result);
      return;
    } else if(current.length == 2) {
      debug('sync processing:', JSON.stringify(blob));
      // 3) function(input, done) { ... }
      current(blob, function(err, blob) {
        self.tasks.shift();
        self._next(err, blob);
      });
      return;
    }
  }

  // last item is [pipe]
  if(this.getTaskType(current) == 'pipe' && this.getTaskType(next) == 'undefined') {
    // write the output
    var stdin = (firstStream.stdin ? firstStream.stdin : firstStream),
        stdout = (current.stdout ? current.stdout : current);

    if(typeof blob === 'undefined' && this.inputPaused) {
      // resume the actual input when the pipe chain ends
      this.inputPaused = false;
      debug('input resume');
      this._input.resume();
    }

    // Specifically, you probably don't want to call .end() on the last item,
    // if it is reused (like process.stdout is)
    if(typeof blob !== 'undefined') {
      debug('buffer to pipe:', JSON.stringify(blob), '->', debugId(firstStream));
      stdin.write(blob);
      stdin.end();
    } else {
      debug('blob is empty');
    }

    // 0.8.x: "close"
    // 0.10.x: "finish"
    var emittedDone = false;
    function emitDone() {
      if(!emittedDone) {
        emittedDone = true;
        debug('emit: "done"');
        self.emit('done', self);
      }
    }
    stdout.once('close', emitDone);
    stdout.once('finish', emitDone);

    return;
  }

  console.log('NOTHING MATCHED!', this.getTaskType(current), this.getTaskType(next));
}

Task.prototype.exec = function() {
  var self = this;

  this.emit('exec');

  // Output can be:
  if(typeof self._output === 'function') {
    debug('Output is a function.');

    // HACK: to work around the issue where too many file handles are opened simply
    // due to instantiating readable streams, allow a arity-0 function
    // to act as a delayed output assignment

    if(self._output.length == 0) {
      this.tasks.push(self._output());
    } else {
      // 1) a function
      this.tasks.push(function(result) {
        self._output(result);
      });
    }
  } else if(typeof self._output === 'object') {
    // 2) a stream
    debug('Output is a stream.');

    self._output.on('error', function(err) {
      console.error('Error in the self._output stream: ', err);
      console.trace();
    });

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
     debug(self.tasks.map(function(task) {
        return self.getTaskType(task);
     }));
    }

  // The first and last items are handled specially

  if(typeof this._input === 'function') {
    debug('Input is a function.');
    // convert to "pipe function"



    this._input = this._input();

    // avoid weird resume() call
    this.inputPaused = false;

    this.tasks.unshift(this._input);
    logTypes();
    this._next(null, undefined);





  } else if(isPrimitive(this._input)) {
    debug('Input is a string.');
    // convert to "sync function"
    logTypes();
    this._next(null, this._input);
  } else if(typeof this._input === 'object') {
    debug('Input is a stream.');
    // convert to "pipe function"
    this.tasks.unshift(this._input);
    logTypes();
    this._next(null, undefined);
  } else {
    throw new Error('Unknown input: ' + this._input);
  }

  return this;
};

module.exports = Task;
