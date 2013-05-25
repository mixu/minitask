# minitask

A standard/convention for running tasks over a list of files based around Node core streams2.

Compatible with Node 0.8.x as well thanks to readable-stream by isaacs.

## Introduction

[grunt](http://gruntjs.com/) is the Javascript task runner that's most popular, but I mostly prefer using makefiles since they require less ceremony.

However, sometimes you want to express something as an operation applied to a list of files, while keeping the ability to plug in more tasks via unix pipes and custom functions. That's what this is, a simple convention for working on a list of files using constructs from the Node core.

minitask is not a makefile replacement, it is a convention for writing things that apply a bunch of pipes to a list of files.

It doesn't even define any significant new APIs - everything is just based on using Node core streams in a specific way and structuring your code into separate tasks.

## The first step: creating and annotating the list of files

Each minitask starts with a list of files, which simply an object that looks like this:

    {
      files: [
        { name: '/full/path/to/file.js' }
      ]
    }

The minitask core API has a file iterator that can build these lists for consumption, given path specifications as inputs.

This array of files is then filtered an annotated using list tasks, which are functions:

    // filter-git-directories: a list task that filters out .git directories from the list
    module.exports = function(list) {
      list.files = list.files.filter(function(item) {
        return !name.match(new RegExp('/\.git/'));
      });
    };

List tasks are basically any tasks that include / exclude or otherwise work on metadata.

To add metadata, you should add properties either to each file, or to the list object itself.

The key benefit of separating tasks such as filtering and annotating metadata into a step that occurs after the list of files is created is that it makes those tasks easier to reuse and test. Previously, I would perform filtering at the same time as I was reading in the file tree. The problem with doing both filtering and file tree iteration is that you end up with some unchangeable filtering logic that's embedded inside your file iterator.

Having your filtering and annotation embedded in the file iterator gets really annoying in some cases: for example, for [gluejs](http://mixu.net/gluejs/) there are multiple filtering rules: package.json files, .npmignore files and user-specified rules. Those were applied in various separate components that basically excluded some paths from traversal based on custom logic.

Rather than special casing and doing two things at the same time, with minitask you read in a file tree and then all filters work on the same structure: an array of paths with metadata. Since filtering is a operation that's separate from reading in the initial tree, it's much easier to see and configure what gets excluded and to define new metadata -related operations.

## Defining tasks that operate on files (= streams)

File tasks are the other type of task. They use the Node 0.10.x stream interface based on a convention that makes using child_process.spawn particularly easy:

    // uglify-task: runs uglify
    var spawn = require('child_process').spawn;
    module.exports = function(options) {
      var task = spawn('uglifyjs', ['--no-copyright']);
      task.on('exit', function(code) {
        task.emit('error', 'Child process exited with nonzero exit code: '+ code);
      });
      return task;
    };

You have to return:

- an object with two streams: { stdin: WritableStream, stdout: ReadableStream }
- or a function that when called returns an object with the stdin and stdout properties

Note that child_process.spawn() returns exactly the right kind of object.

The key here is that every file task is a Node 0.10.x stream. Streams are easy to compose together via pipe(), and all I/O objects in Node are streams. This makes it easy to compose file tasks and to redirect them to different places.

If you're doing a JS-based stream transformation, then you can return a instance of Node core's [stream.Transform](stream.Transform) duplex stream, wrapped to look like a process:

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

This also means that any 3rd party code that implements on `stream.Transform` is immediately usable with just a wrapping function that creates a new instance.

## Running tasks

The last piece of minitask is the runner.

The runner is the last task, it is responsible for using list tasks and file tasks to achieve whatever it wants. There are no strong requirements here; it's not worth it to really try to standardize the runner in my opinion - the overhead of dealing with some kind of standard for expressing a workflow is less than the benefits of reuse. Whatever can be reused should be extracted into file tasks and list tasks and the runner is everything that can't be reused.

The first parameter is the list structure of files, without any filters or tasks applied to it.

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

The runner is king, it gets to decide what to do with the tree and options it's supplied.

## API docs

The minitask core basically defines a set of helpers that support these convetions:

- `list.js` is the thing that iterates paths and returns a file list array for further consumption
- `runner.js` is a function that applies a set of file tasks on a readable stream and returns a writable stream

TODO: document the runner and list

TODO: specify how the list should be annotated with tasks
