## Runner API: executing the task queue

In phase 2, some custom workflow creates `Task` instances.

Each task instance is a pipe from a input file (ReadableStream) to a chain of transformations which produces some output.

If the tasks are independent, then running them is simple: just use any regular asynchronous concurrency control library that allows you to run each task.

The runner is only designed for cases where you are producing a single output out of many streams. One example is a packaging system, which produces a single output file out of several files.

The runner accepts a (linear) array of:

- Task objects and
- functions that write into a stream

For example:

     // running a set of concatenated tasks
     runner.concat(fs.createWriteStream('./tmp/concatenated.txt'), [
        function(out, done) {
          out.write('// begin \n');
          done();
        },
        new Flow([ tasks ]).input(file),
        new Flow([ tasks ]).input(file2),
        function(out) {
          out.write('// end \n');
          done();
        },
      ], {
        limit: 16
      })

How is this executed?

- First, the runner scans through the input and finds each flow
- Next, it replaces each flow with a "read from file" task; where the file is the temp file or cache file
- Next, it runs each flow at the specified level of parallelism, directing the output into the cache or a temp file
- Once all the task flows have run, it creates a new writable stream, runs each function(out) in the order specified, streaming the flow task outputs in the correct order to produce the final file.

When the tasks are concatenated: to enable greater parallelism (than level one, where each task is executed serially), the tasks need to written out to disk or memory. If two tasks are running concurrently and writing into process.stdout, then their outputs will be interspersed. This is why most task execution systems can only run one task at a time and a key limitation of many of the earlier designs I did for command line tools.

Writing out to disk isn't that bad; it also enables caching.

## Task extras when using the runner

Events that are only emitted if a cache is used

- `hit`: function to run when cache hit (useful for reporting on how many files were fetched from the cache).
- `miss`: function to run when cache miss

These are emitted as the task running starts, e.g. 'hit' if we use the cached version, 'miss' if we have to exec the task.
