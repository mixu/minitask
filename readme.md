# minitask

A standard/convention for running tasks over a list of files based around Node core streams2.

minitask is a library for processing tasks on files. It is used in many of my projects, such as `gluejs` and `generate-markdown`.

Most file processing tasks can be divided into three phases, and minitask provides tools for each phase:

    [ 1. Directory iteration: selecting a set of files to operate on, using the List class ]
    [ 2. Task definition:
          - defining operations on files using the Task class
          - making use of cached results using the Cache class ]
    [ 3. Task execution:
          - executing operations in parallel using the Runner class
          - storing cached results using the Cache class ]

Separating these into distinct phases has several advantages. The main advantage is that each of these operations can be written independently of the other two: e.g. no task definition during iteration and no execution parallelism concerns during task definition.

Further, separating task definition from execution allows for much greater execution parallelism compared to a naive sequential stream processing implementation. This means faster builds.

## Key features

- better code organization through distinct processing stages
- input-file-checksum/input-file-modification based result caching
- makes it easier to combine different ways to express a transformation, from synchronous functions to streams and child processes
- high parallelism through queue-then-multiplex-over-executors pattern, which allows subtasks to run at high concurrency

## List API: Reading input directories

The List API essentially consists of:

- the `add` function which adds path targets
- filtering and search functions such as `exclude` and `find` which select files
- the `exec` function which performs the actual traversal

A few notes:

- there is a tradeoff between extremely accurate initial scans and code complexity. The List class allows you to perform basic filtering with the idea that more advanced filters can be applied further downstream (e.g. using `[].filter` on the result)
- the List has a separate `add` and `exec` function because this allows the same List object to be run multiple times against a changing directory structure, which is nice if you are running the same operations multiple times (e.g. in a server).

The list API is documented in [docs/list.md](docs/list.md).

## Task API: Defining tasks on input files

The Task API provides a way to express a set of transformations using an array of:

- sync functions
- async functions
- duplex streams
- child process executions

without having to worry about the details of how these things are connected. Node's duplex streams are [a bit tedious](http://nodejs.org/api/stream.html#stream_example_simpleprotocol_parser_v2)  for simple transforms and Node's `child_process` returns [something that's not quite a duplex stream](http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options). The Task API works around those limitations by providing some plumbing, and returns a queueable task object that can be run later.

A few notes:

- One of the major lessons learned is that any task definition API must never allocate resources before they are needed, because otherwise it becomes infeasible to define large task queues (e.g. since file handles are a limited resource and holding them for queued tasks quickly exhausts the file handle ulimit).
- Many 3rd party transforms are not streaming (e.g. because many things are easiest to write as transforms on all of the data rather than as streaming transforms), which is why the Task API makes integrating both streams and non-streams easy.

The task API is documented in [docs/task.md](docs/task.md).

## Cache API: storing results

Tasks are often run multiple times without the underlying file changing, which means we can skip the work and use a cached version. The cache API handles:

- storing metadata about a input file
- storing result files related to a input file
- invalidating stored metadata when the input changes

The cache API supports storing result files and file metadata in a way that ensures that if the underlying file changes, the related cached data is invalidated. The input file can be checked using size + date modified, or by running a hash algorithm such as md5 on the file.

A few notes:

- the three key issues wrt. cache implementation are:
  - handling cache metadata corruption
  - handling garbage collection of files and data in the cache
  - making sure that accessing the cache is inexpensive yet correct
- At the core, it is very easy to end up accessing the cache several times in a very short interval when executing a particular operation. A reasonable compromise is to optionally allow the user of the cache to specify the beginning and end of a set of operations (e.g. a build task execution). During the operation, is each file is checked at most once, which is what you generally want and a reasonable tradeoff between paranoia and performance.
- Similarly, metadata updates are only written back from memory to the metadata file at the end of the operation.

The cache API is documented in [docs/cache.md](docs/cache.md).

## Runner API: executing the task queue

The runner API is documented in [docs/runner.md](docs/runner.md).
