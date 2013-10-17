var fs = require('fs'),
    assert = require('assert'),
    runner = require('minitask').runner,
    Flow = require('minitask').Task;

var tasks = [
/*
    function c(input) {
      return 'c' + input + 'c';
    }
*/
    function() {
      var spawn = require('child_process').spawn;
      return spawn('wc', [ '-c']);
    }

  ];

var fixDir = __dirname + '/fixtures',
    tmpDir = __dirname + '/tmp';

module.exports['runner tests'] = {

  'run concatenated flows': function(done) {
    var a = new Flow(tasks).input(fs.createReadStream(fixDir + '/dir-wordcount/a.txt')),
        b = new Flow(tasks).input(fs.createReadStream(fixDir + '/dir-wordcount/b.txt'));

    a.inputFilePath = fixDir + '/dir-wordcount/a.txt';
    b.inputFilePath = fixDir + '/dir-wordcount/b.txt';
    a.taskHash = b.taskHash = 'test1';

    runner
      .parallel([
        a,
        b
      ], {
        cachePath: __dirname + '/cache',
        cacheMethod: 'stat',
        limit: 16,
        output: fs.createWriteStream(tmpDir + '/concatenated.txt'),
        onDone: function() {
          assert.equal(fs.readFileSync(tmpDir + '/concatenated.txt').toString(), '12\n6\n');
          done();
        }
      });
  },

  'run functions': function(done) {
    runner
      .parallel([
        function(out, done) {
          out.write('hello ');
          done();
        },
        function(out, done) {
          out.write('world\n');
          done();
        }
      ], {
        cachePath: __dirname + '/cache',
        cacheMethod: 'stat',
        limit: 16,
        output: fs.createWriteStream(tmpDir + '/concatenated2.txt'),
        onDone: function() {
          assert.equal(fs.readFileSync(tmpDir + '/concatenated2.txt').toString(), 'hello world\n');
          done();
        }
      });
  },

  'run mixture of flows and functions': function(done) {
    var a = new Flow(tasks).input(fs.createReadStream(fixDir + '/dir-wordcount/a.txt'));

    a.inputFilePath = fixDir + '/dir-wordcount/a.txt';
    a.taskHash = 'test2';

    runner
      .parallel([
        function(out, done) {
          out.write('hello ');
          done();
        },
        a
      ], {
        cachePath: __dirname + '/cache',
        cacheMethod: 'stat',
        limit: 16,
        output: fs.createWriteStream(tmpDir + '/concatenated2.txt'),
        onDone: function() {
          assert.equal(fs.readFileSync(tmpDir + '/concatenated2.txt').toString(), 'hello 12\n');
          done();
        }
      });
  }

/*
  'run a set of concatenated tasks with caching': function() {
    var a = new Flow(tasks).input(fs.createReadStream(fixDir + '/dir-wordcount/a.txt')),
        b = new Flow(tasks).input(fs.createReadStream(fixDir + '/dir-wordcount/b.txt'));

    a.inputFilePath = fixDir + '/dir-wordcount/a.txt';
    b.inputFilePath = fixDir + '/dir-wordcount/b.txt';
    a.taskHash = b.taskHash = 'test1';

    runner
      .parallel(fs.createWriteStream(tmpDir + '/concatenated.txt'), [
        a,
        b
      ], {
        cachePath: __dirname + '/cache',
        cacheMethod: 'stat',
        limit: 16,
        output: fs.createWriteStream(tmpDir + '/concatenated.txt'),
        onDone: function() {
          assert.equal(fs.readFileSync(tmpDir + '/concatenated.txt').toString(), '12\n6\n');
          done();
        }
      });
  }
*/

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
