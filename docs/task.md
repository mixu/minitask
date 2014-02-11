# Task API

For example, here I am applying four transformations on a stream, each specified in a different manner (sync fn, async fn, child process, duplex stream):

````javascript
var flow = new Task([
    // sync function
    function (input) {
      return 'bb' + input.trim() + 'bb';
    }),
    // async function
    function (input, done) {
      setTimeout(function() {
        done(null, 'c' + input.trim() + 'c');
      }, 10);
    },
    // spawned child process
    function() {
      var spawn = require('child_process').spawn;
      return spawn('wc', [ '-c']);
    },
    // duplex stream (not showing the details on how you can write these;
    // see http://nodejs.org/api/stream.html#stream_class_stream_transform
    // for the details)
    function() {
      return new Duplex();
    }
]);
````

This unified interface means that you don't need to worry about how your transformation is implemented, as long as it follows one of the four forms above, the Task class will take care of calling the right functions (`pipe` / `write` / `read`) and it takes care of buffering when transitioning between streams and functions.

Also:

- any 3rd party code that implements on `stream.Transform` is immediately usable
- any external tool that reads from `stdin` and writes to `stdout` is immediately usable

There is a reason why tasks are functions. This is so that we don't create instances of streams until they are executed. Otherwise, you can easily run out of resources - for example, if you spawn a new task for every file immediately.

The input and output can be strings or streams:

````javascript
// from string input to string output
flow.input('AA')
    .output(function(output) {
      console.log(output);
    }).exec();

// from stream input to stream output
flow.input(fs.createReadStream('./foo.txt'))
    .output(fs.createWriteStream('./bar.txt'))
    .exec();
````

API:

- `new Task(tasks)`: creates a new flow with the given tasks
- `.input(string | ReadableStream)`:
- `.output(fn | WritableStream) `:

A small note on Node 0.8 and stream instances: Passing a stream to `.input()` automatically calls `.pause()` on that stream. This is because the event handlers are only attached when `.exec` is called; Node (0.8) may prematurely start emitting data if not paused. If you're instantiating the writable streams at a much earlier point in time, make sure you call `pause()` on them.

Events:

- `exec`: emitted when exec is called
- `done`: emitted when done

Events that are only emitted if a cache is used

- `hit`: function to run when cache hit (useful for reporting on how many files were fetched from the cache).
- `miss`: function to run when cache miss
