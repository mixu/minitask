# minitask

A standard/convention for running tasks over a list of files based around Node core streams2.

Compatible with Node 0.8.x as well thanks to readable-stream by isaacs.

## Introduction

[grunt](http://gruntjs.com/) is the Javascript task runner that's most popular, but I mostly prefer using makefiles since they require less ceremony.

However, sometimes you want to express something as an operation applied to a list of files, while keeping the ability to plug in more tasks via unix pipes and custom functions. That's what this is, a simple convention for working on a list of files using constructs from the Node core.

minitask is not a makefile replacement, it is a convention for writing things that apply a bunch of pipes to a list of files.

minitask doesn't even define any new APIs (unlike, say, [node-task](https://github.com/node-task/spec/wiki), which is destined to become grunt's next set of internals which seems to implement their own (!) synchronous (!!) version of core streams). In minitask, everything is just based on using [Node core streams](http://nodejs.org/api/stream.html) in a specific way and structuring your code into reusable tasks. The minitask repo is a bunch of functions that support those conventions.

## The first step: creating and annotating the list of files

Each minitask starts with a list of files, which simply an object that looks like this:

    {
      files: [
        { name: '/full/path/to/file.js' }
      ]
    }

The minitask core API has a file iterator that can build these lists for consumption, given path specifications as inputs.

This array of files is then filtered an annotated using list tasks, which are functions. For example, `filter-git.js`:

````javascript
// filter-git-directories: a list task that filters out .git directories from the list
module.exports = function(list) {
  list.files = list.files.filter(function(item) {
    return !item.name.match(new RegExp('/\.git/'));
  });
};
````

List tasks are basically any tasks that include / exclude or otherwise work on metadata.

To add metadata, you should add properties either to each file, or to the list object itself. For example, `annotate-stat.js`:

````javascript
var fs = require('fs');

// This task adds a .stat property to every file in the list
module.exports = function(list) {
  list.files.forEach(function(item, i) {
    list.files[i].stat = fs.statSync(item.name);
  });
};
````

The key benefit of separating tasks such as filtering and annotating metadata into a step that occurs after the list of files is created is that it makes those tasks easier to reuse and test. Previously, I would perform filtering at the same time as I was reading in the file tree. The problem with doing both filtering and file tree iteration is that you end up with some unchangeable filtering logic that's embedded inside your file iterator.

Having your filtering and annotation embedded in the file iterator gets really annoying in some cases: for example, for [gluejs](http://mixu.net/gluejs/) there are multiple filtering rules: package.json files, .npmignore files and user-specified rules. Those were applied in various separate components that basically excluded some paths from traversal based on custom logic.

Rather than special casing and doing two things at the same time, with minitask you read in a file tree and then all filters work on the same structure: an array of paths with metadata. Since filtering is a operation that's separate from reading in the initial tree, it's much easier to see and configure what gets excluded and to define new metadata -related operations.

## Defining tasks that operate on files (= streams)

File tasks are the other type of task.

There are three different alternatives, corresponding to different native APIs:

- streams: returning an object with { stdout: ..., stdin: ... }
- async calls: returning a function of arity 2: function(onEach, onDone) {}


They use the Node 0.10.x stream interface based on a convention that makes using child_process.spawn particularly easy:

````javascript
// uglify-task: runs uglify
var spawn = require('child_process').spawn;
module.exports = function(options) {
  var task = spawn('uglifyjs', ['--no-copyright']);
  task.on('exit', function(code) {
    task.emit('error', 'Child process exited with nonzero exit code: '+ code);
  });
  return task;
};
````

You have to return:

- an object with two streams: { stdin: WritableStream, stdout: ReadableStream }
- or a function that when called returns an object with the stdin and stdout properties

Note that child_process.spawn() returns exactly the right kind of object.

The key here is that every file task is a Node 0.10.x stream. Streams are easy to compose together via pipe(), and all I/O objects in Node are streams. This makes it easy to compose file tasks and to redirect them to different places.

If you're doing a JS-based stream transformation, then you can return a instance of Node core's [stream.Transform](stream.Transform) duplex stream, wrapped to look like a process:

````javascript
// use readable-stream to use Node 0.10.x streams in Node 0.8.x
var Transform = require('readable-stream').Transform;

function Wrap(options) {
  Transform.call(this, options);
  this.first = true;
}

// this is just the recommended boilerplate from the Node core docs
Wrap.prototype = Object.create(Transform.prototype, { constructor: { value: Wrap }});

Wrap.prototype._transform = function(chunk, encoding, done) {
  if(this.first) {
    this.push('!!');
    this.first = false;
  }
  this.push(chunk);
  done();
};

Wrap.prototype._flush = function(done) {
  this.push('!!');
  done();
};

module.exports = function(options) {
  var instance = new Wrap(options);
  // since it's a duplex stream, let the stdin and stdout point to the same thing
  return {
    stdin: instance,
    stdout: instance
  };
};
````

This also means that any 3rd party code that implements on `stream.Transform` is immediately usable with just a wrapping function that creates a new instance.

## Running tasks

The last piece of minitask is the runner.

The runner is the last task, it is responsible for using list tasks and file tasks to achieve whatever it wants. There are no strong requirements here; it's not worth it to really try to standardize the runner in my opinion - the overhead of dealing with some kind of standard for expressing a workflow is less than the benefits of reuse. Whatever can be reused should be extracted into file tasks and list tasks and the runner is everything that can't be reused.

The first parameter is the list structure of files, without any filters or tasks applied to it.

````javascript
// serve-index:
var http = require('http');

module.exports = function(list, options) {
  http.createServer(function(req, res) {
    if(req.url == '/') {
      res.end('<html><ul><li>'+ tree.files.join('</li><li>') +'</li></ul></html>');
    } else {
      res.end('Unknown: ' + req.url);
    }
  }).listen(8000).on('listening', function() {
    console.log('Listening on localhost:8000');
  });
};
````

The runner is king, it gets to decide what to do with the tree and options it's supplied.

## API docs

The minitask core basically defines a set of helpers that support these convetions:

- `list.js` is the thing that iterates paths and returns a file list array for further consumption
- `runner.js` is a function that applies a set of file tasks on a readable stream and returns a writable stream

TODO: document the list

TODO: specify how the list should be annotated with tasks

### Runner API

The runner is a helper method that takes an input stream (e.g. an object { stdout: ... }), an array of tasks and a done function. It instantiates tasks if necessary, and pipes the tasks together, and ensures that the last task in the pipeline calls the done function.

Usage example:

    var runner = require('minitask').runner,
        tasks = [ fileTask, ... ];

    var last = runner({ stdout: fs.createReadStream(filename) }, tasks, function() {
      console.log('done');
    });
    // need to do this here so we can catch the second-to-last stream's "end" event;
    last.stdout.pipe(process.stdout, { end: false });


## Caching

File processing tasks such as package builds and metadata reads are often run multiple times. It is useful to cache the output from these tasks and only re-run the processing when a file has changed. GNU Make, for example, relies on dependency resolution + file last modified timestamps to skip work where possible.

A cacheable task is any task that reads a specific file path and writes to a writable stream at the end.

The caching system can either use a md5 hash, or the last modified+file size information to determine whether a task needs to be re-run. Additionally, an options hash can be passed to take into account different additional options.

When the caching system is used, the task output is additionally written to a separate file. The assumption here is that each file task (with a task options hash and input md5) performs the same deterministic transformation. When the current input file's md5 and task options hash match, then the previously written cached result is streamed directly rather than running the full stack of transformations.

### Cache API

The cache API looks a lot like the runner API, but it requires an explicit file path and options hash.

    var last = cache({ filepath: filepath, cachepath: ..., md5: ..., stat: ..., options: ... }, tasks, function() {

    });


## Command line tool

