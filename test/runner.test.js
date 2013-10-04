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

module.exports['runner tests'] = {

  'run concatenated flows': function(done) {
    runner
      .parallel([
        new Flow(tasks)
          .input(fs.createReadStream('./fixtures/dir-wordcount/a.txt')),
        new Flow(tasks)
          .input(fs.createReadStream('./fixtures/dir-wordcount/b.txt')),
      ], {
        limit: 16,
        output: fs.createWriteStream('./tmp/concatenated.txt'),
        onDone: function() {
          assert.equal(fs.readFileSync('./tmp/concatenated.txt').toString(), '12\n6\n');
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
        limit: 16,
        output: fs.createWriteStream('./tmp/concatenated2.txt'),
        onDone: function() {
          assert.equal(fs.readFileSync('./tmp/concatenated2.txt').toString(), 'hello world\n');
          done();
        }
      });
  },

  'run mixture of flows and functions': function(done) {
    runner
      .parallel([
        function(out, done) {
          out.write('hello ');
          done();
        },
        new Flow(tasks)
          .input(fs.createReadStream('./fixtures/dir-wordcount/a.txt'))
      ], {
        limit: 16,
        output: fs.createWriteStream('./tmp/concatenated2.txt'),
        onDone: function() {
          assert.equal(fs.readFileSync('./tmp/concatenated2.txt').toString(), 'hello 12\n');
          done();
        }
      });
  }

/*
  'run a set of concatenated tasks with caching': function() {
    var opts = {
      path: './tmp/cache',
      options: { foo: 'bar '},
      method: 'stat' // | 'md5'
    };

    runner
      .parallel(fs.createWriteStream('./tmp/concatenated.txt'), [
        new Flow(tasks)
          .cache('./fixtures/dir-wordcount/a.txt', opts)
        new Flow(tasks)
          .cache('./fixtures/dir-wordcount/b.txt', opts)
      ], {
        limit: 16,
        output: fs.createWriteStream('./tmp/concatenated.txt'),
        onDone: function() {
          assert.equal(fs.readFileSync('./tmp/concatenated.txt').toString(), '12\n6\n');
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
