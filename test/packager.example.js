var fs = require('fs'),
    runner = require('minitask').runner,
    Flow = require('minitask').Task;

var packages = [
  { files: [ { name: __dirname + '/fixtures/bar.txt' } ],
    dependenciesById: { aa: 1 } },

  { name: 'aa',
    uid: 1,
    basepath: '/fixtures/node_modules/aa/',
    main: 'index.js',
    files: [ { name: __dirname + '/fixtures/hash.txt' } ] }

  ];


var packageTasks = [];

packageTasks.push(function(out, done) {
  out.write('// Global header \n');
  done();
});

packages.forEach(function(packageObj, packageIndex) {

  packageTasks.push(function(out, done) {
    out.write('// Package header: ' + (packageObj.name ? packageObj.name : 'root') + ' \n');
    done();
  });

  packageObj.files.forEach(function(file, fileIndex) {
    var flow = new Flow([
        function(input) {
          return '// Begin file\n' +
                 input +
                 '\n// End file\n';
        }]).input(fs.createReadStream(file.name));

    flow.inputFilePath = file.name;
    flow.taskHash = require('minitask').Cache.hash(JSON.stringify(packages));

    packageTasks.push( flow );
  });

  packageTasks.push(function(out, done) {
    out.write('\n// Package footer\n');
    done();
  });

});

packageTasks.push(function(out, done) {
  out.write('// Global footer \n');
  done();
});

runner.parallel(packageTasks, {
    cachePath: __dirname + '/cache',
    cacheMethod: 'stat',
    output: process.stdout,
    limit: 16,
    end: false,
    onDone: function() {
      console.log('DONE!');
    }
});
