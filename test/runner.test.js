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

  'run a set of independent tasks': function(done) {
    runner
      .parallel([
        new Flow([
           function() {
                var spawn = require('child_process').spawn;
                return spawn('wc', [ '-c']);
              }
          ])
          .input(fs.createReadStream('./fixtures/dir-wordcount/a.txt'))
          .output(fs.createWriteStream('./tmp/independent-a.txt')),
        new Flow([
           function() {
                var spawn = require('child_process').spawn;
                return spawn('wc', [ '-c']);
              }
          ])
          .input(fs.createReadStream('./fixtures/dir-wordcount/b.txt'))
          .output(fs.createWriteStream('./tmp/independent-b.txt'))
      ], {
        limit: 16,
        onDone: function() {
          // character lengths
          assert.equal(fs.readFileSync('./tmp/independent-a.txt').toString(), 12);
          assert.equal(fs.readFileSync('./tmp/independent-b.txt').toString(), 6);
          done();
        }
      })
  },

  'when flow.hasOutput() is false, set .output to a temporary directory': function() {

  },

  'run a set of concatenated tasks': function(done) {
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

/*
  'run a set of concatenated tasks with caching': function() {
    runner
      .parallel(fs.createWriteStream('./tmp/concatenated.txt'), [
        'Hello world',
        new Flow(tasks)
          .input(fs.createReadStream('./fixtures/dir-wordcount/a.txt')),
        new Flow(tasks)
          .input(fs.createReadStream('./fixtures/dir-wordcount/b.txt')),
        'End file',
      ], {
        limit: 16,
        cache: {
          path: './tmp/cache',
          options: { foo: 'bar '},
          method: 'stat' // | 'md5'
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
