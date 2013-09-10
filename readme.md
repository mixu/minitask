# minitask

A standard/convention for running tasks over a list of files based around Node core streams2.

Compatible with Node 0.8.x as well thanks to readable-stream by isaacs.

## Key features

- Provides a decent convention for writing programs that deal with files and/or data streams (with caching, task pipeline specification and parallel execution).
- Makes it easier to combine different ways to express a transformation: allows you to treat synchronous functions, asynchronous functions, child processes and duplex streams as equivalent parts of a stream transformation task.
- Buffering only if necessary. If all tasks are streaming (e.g. duplex / transform streams and child processes from input to output), then no buffering is performed. If a task queue consists of sync / async functions and streams, then buffering is performed automatically at the transitions between different transformation types. It's often easier to prototype using functions; you can rewrite functions into streams to get rid of buffering.
- Caching support: each task's result can be cached; the cached result is reused if the metadata (e.g. file modification date and file size or, alternatively, the md5 of the file) don't change.
- Specifically designed for dealing with the common special case where multiple files are concatenated into one in a specific order, but the subtasks need to be run in parallel.

## Introduction

minitask is a library I wrote for processing tasks on files.

It is used in several of my libraries, including `gluejs` and `generate-markdown`.

minitask is based on the observation that most tasks including files can be divided into three phases:

1. Directory iteration. This is where some set of input files are selected based on user input (e.g. via the command line or config options). Some files may be excluded from the list.
2. Task queuing. Given a list of included files, some tasks are queued for each file (e.g. based on their file extensions).
3. Task execution. The tasks are executed in parallel or sequentially, and the output is potentially cached and written out to stdout or a file.

When you try to do all these in one go (e.g. at the same time as you are iterating directories), things get messy. It's a lot easier to work with fully built directory/file metadata structures separately from the include/exclude logic; and easier to reason about execution order separate from task queueing.

It should be easy to specify tasks as sequences of transformations on a stream. While duplex streams are cool, expressing simple tasks like wrapping a stream in a string is [quite tedious](http://nodejs.org/api/stream.html#stream_example_simpleprotocol_parser_v2) if you need to wrap it in a duplex stream class. To be fair, the core Transform stream is probably the best one can do if you want to express something as a stream; however, many 3rd party transforms are not streaming or are easier to express as computations over a whole - e.g. convert a file's content to markdown, or wrap a file in a particular template.

Furthermore, Node's `child_process` API returns [something that's not quite a duplex stream](http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options), though it has `stdin` and `stdout`. It should be possible to write functions, child_process pipes and tasks involving duplex streams/transform streams without worrying about the details of buffering and piping everything together.

Finally, during task execution, it is useful to be able to treat each set of transformations on a file individually and in an abstract manner. This allows a queue of tasks to be executed at some specific level of parallelism. It also makes it possible to implement a fairly generic caching mechanism, which simply redirects the input into a cache file while still producing the expected output.

All in all, this makes writing things that operate on files nicer without becoming overly burdensome.

## Phase 1: Directory iteration

The `List` class only has one method: `add(path)`. For example:

    var List = require('minitask').list,
        files = new List();

    files.add(path.resolve(process.cwd(), './foo'));

If the path is a directory, then it is iterated recursively.

Note that there is no "exclude" - the idea is that you exclude things in postprocessing rather than trying to build in a lot of complicated exclusion logic during iteration.

This produces an object with at `.files` property, which looks like this:

    {
      files: [
        {
          name: '/full/path/to/file.js',
          stat: { ... fs.Stat object ... }
        }
      ]
    }

Each file is annotated with a `fs.Stat` object, since you'll need that information anyway to distinguish between directories and files when iterating over directories..

### Phase 1.1: List filtering

Exclusions are applied by filtering out items from the list. For example, `filter-regex.js`:

````javascript
// Filter out files from a list by a blacklist of regular expressions
module.exports = function(list, expressions) {
  list.files = list.files.filter(function(file) {
    var name = file.name,
        matchedExpr,
        match = expressions.some(function(expr) {
          var result = name.match(expr);
          if(result) {
            matchedExpr = expr;
          }
          return result;
        });
    if(match) {
      console.log('Excluded by regexp ', matchedExpr, ':', name);
    }
    return !match;
  });
};
````

Which might be applied like this:

````javascript
var filterRegex = require('../lib/list-tasks/filter-regex.js');
// where `list` is an instance of List
filterRegex(list, [ new RegExp('\/dist\/'), new RegExp('[-.]min.js$') ]);
````

Since filtering is a operation that's separate from reading in the initial tree, it's much easier to see and configure what gets excluded and to define new metadata -related operations. These tasks also becomes easier to reuse and test (no file I/O involved). No unchangeable filtering logic gets embedded into the directory iteration code.

## Phase 2: Task queuing

Here, we are defining tasks that operate on input streams. These are generated by iterating over the file metadata in some appropriate manner.

The task queueing function is a function that takes a `List` as a first argument and produces task arrays.

There is one "master queue" into which each file processing task gets added. In phase 3, that queue is cleared by running it in parallel or sequentially.

As I stated earlier, it should be possible to write functions, child_process pipes and tasks involving duplex streams/transform streams without worrying about the details of buffering and piping everything together. This is what the `Task` class does.

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

A small note on Node 0.8 and stream instances: Passing a stream to `.input()` automatically calls `.pause()` on that stream. This is because the event handlers are only attached when `.exec` is called; Node (0.8) may prematurely start emitting data if not paused. If you're instantiating the writable streams at a much earlier point in time, make sure you call `pause()` on them.

### 2.1 Task level caching

Caching requires the following:

- `name`: the input item name. Usually the full path to the input file (but you can use any string you want)
- `cachepath`: the cache directory path. A directory where to store the cached results (a metadata file and a cached version are stored)
- `method`: the method to use. Either 'stat' (use the full path to the input file as the name)
- `options`: a description of the options used for this task. You need to know something about the operation which is being applied, otherwise two different tasks on the same input file would share the same cache result. If you're just applying one set of tasks per file, then just pass whatever global options were used here.

Optional information:

- `stat`: a file stat object (for the "" if you already have called `fs.stat` on the file)
- `onHit`: function to run when cache hit (useful for reporting on how many files were fetched from the cache).
- `onMiss`: function to run when cache miss

## 3. Running tasks

In phase 2, some custom workflow creates `Task` instances. Each instance is assumed to consist of an independently executable stream of transformations which produce some output.

There are two basic options:

- The tasks are written out on a 1-1 basis. For example, when each file is transpiled into one output. One example is a markdown to html converter.
- The (some of) the tasks are concatenated. For example, when a directory of files is transformed and then a concatenated version is produced. One example is a packaging system which produces a single file out of several files.

Now, in phase 3, those tasks need to be run:

    [ process.stdout ]
      | - foo
          - bar.txt
          - baz.txt
      | - abc
          - def.txt

When the tasks are written out to different locations: the tasks can be run independently of each other and in any order. There are no ordering requirements.

When the tasks are concatenated: to enable greater parallelism (than level one, where each task is executed serially), the tasks need to written out to disk or memory. If two tasks are running concurrently and writing into process.stdout, then their outputs will be interspersed. This is why most task execution systems can only run one task at a time and a key limitation of many of the earlier designs I did for command line tools.

Writing out to disk isn't that bad; it also enables caching.

Concretely, this means executing each task and caching each output, then running through the linear list of tasks and reading the results in order to produce an output that is a concatenation of every task.

Note that this means that some of the parts of the list are not tasks, but rather pure wrapping text which do not take any inputs. Those should be skipped on the first run.

    // running a set of independent tasks
    runner.parallel([
        new Flow([ tasks ]).input(file).output(file),
        new Flow([ tasks ]).input(file2).output(file2)
      ], {
        limit: 16,
        onDone: function() {
          ...
        }
      })

     // running a set of concatenated tasks
     runner.parallel([
        new Flow([ tasks ]).input(file),
        new Flow([ tasks ]).input(file2)
      ], {
        limit: 16,
        output: fs.createWriteStream('./tmp/concatenated.txt')
      })

**TODO** Update the rest of this doc.

### 3.1 Caching

    runner
      .parallel(fs.createWriteStream('./tmp/concatenated.txt'), [
        new Flow(tasks)
          .input(fs.createReadStream('./fixtures/dir-wordcount/a.txt')),
        new Flow(tasks)
          .input(fs.createReadStream('./fixtures/dir-wordcount/b.txt'))
      ], {
        limit: 16,
        cache: {
          path: './tmp/cache',
          options: { foo: 'bar '},
          method: 'stat' // | 'md5'
        }
      });

## Caching

File processing tasks such as package builds and metadata reads are often run multiple times. It is useful to cache the output from these tasks and only re-run the processing when a file has changed. GNU Make, for example, relies on dependency resolution + file last modified timestamps to skip work where possible.

A cacheable task is any task that reads a specific file path and writes to a writable stream at the end.

The caching system can either use a md5 hash, or the last modified+file size information to determine whether a task needs to be re-run. Additionally, an options hash can be passed to take into account different additional options.

When the caching system is used, the task output is additionally written to a separate file. The assumption here is that each file task (with a task options hash and input md5) performs the same deterministic transformation. When the current input file's md5 and task options hash match, then the previously written cached result is streamed directly rather than running the full stack of transformations.

## Command line tool

