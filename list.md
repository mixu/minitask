## List API: Reading input directories

- `new List({ basepath: process.cwd() })`
- `.add(path)`: If the path is a directory, then it is iterated recursively.
- `.exclude(callback)`: exclude functions
- `.exec(function(err, files) { })`

In general, the idea is that things are mostly excluded in postprocessing rather than trying to build in a lot of complicated exclusion logic during iteration. Some simple exclusions are supported - for example, excluding all source control directories.

Since filtering is a operation that's separate from reading in the initial tree, it's much easier to see and configure what gets excluded and to define new metadata -related operations.

`exec()` produces an object which looks like this, sorted by file name:

    [
      {
        name: '/full/path/to/file.js',
        stat: { ... fs.Stat object ... }
      }
    ]

Each file is annotated with a `fs.Stat` object, since you'll need that information anyway to distinguish between directories and files when iterating over directories.

Note: calling `.exec` will traverse the directory tree again, starting from each path that has been added to the list. This means that any changes made to the directory structure between `.add` and `.exec` are reflected in the resulting list of files.

## Example: traversing a set of paths and creating a sorted list of files

    var List = require('minitask').list,
        list = new List({ basepath: process.cwd() });

    list.add('./foo');
    list.exec(function(err, files) {
      console.log(files);
    });

`basepath` is optional and defaults to `process.cwd()`. All relative paths are resolved relative to the basepath.

## Example: excluding source control directories

    var list = new List();
    list.exclude([
      function(p) { return p.match(/\/.svn/); },
      function(p) { return p.match(/\/.git/); },
      function(p) { return p.match(/\/.hg/); },
      function(p) { return p.match(/\/CVS/); }
    ]);
    list.add('./foo');
    list.exec(function(err, files) {
      console.log(files);
    });


## Example: using custom traversal logic to only include a given file and all of its dependencies

    var list = new List();
    list.add('./foo');
    list.exclude(function(filepath, stat) {
      // only .js files
      return path.extname(filepath) != '.js';
    });
    list.find(function(filepath, stat, onDone) {
      var basepath = path.dirname(filepath),
          deps;
      try {
        deps = detective(fs.readFileSync(filepath).toString());
      } catch(e) {
        console.log('parse error: ', fullpath, e);
        return onDone(null, []);
      }

      if(!deps || deps.length === 0) {
        return onDone(null, []);
      }

      return onDone(null, deps.filter(function(dep) {
          return !resolve.isCore(dep);
        }).map(function(dep) {
          var normalized;

          try {
            normalized = resolve.sync(dep, { basedir: basepath });
          } catch(e) {
            console.log('resolve error: ', e, dep, basepath);
            return undefined;
          }
          return path.normalize(normalized);
        }).filter(Boolean));
    });
    list.exec(function(err, files) {
      console.log(files);
    });
