var fs = require('fs'),
    assert = require('assert'),
    Task = require('minitask').Task;

module.exports['basic'] = {

  'functions that are not streaming and not asynchronous': function(done) {
    var input = 'a';

    function b(input) {
      return 'bb' + input + 'bb';
    }

    function c(input) {
      return 'c' + input + 'c';
    }

    var flow = new Task([b, c]);

    flow.input(input)
        .output(function(output) {
          assert.equal(output, 'cbbabbc');
          done();
        }).exec();
  },
  'functions that are streaming and asynchronous': function(done) {
    var input = 'a';

    function b(input, done) {
      setTimeout(function() {
        done(null, 'bb' + input + 'bb');
      }, 10);
    }

    function c(input, done) {
      setTimeout(function() {
        done(null, 'c' + input + 'c');
      }, 10);
    }

    var flow = new Task([b, c]);

    flow.input(input)
        .output(function(output) {
          assert.equal(output, 'cbbabbc');
          done();
        }).exec();
  },

  'task is a function that returns an object with .stdout and .stdin': function(done) {
    var input = 'abcdef',
        tasks = [
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          }
        ],
      flow = new Task(tasks);

    flow.input(input)
        .output(function(output) {
          console.log(output.trim());
          assert.equal(output.trim(), '6');
          done();
        }).exec();
  },

  'task is a function that returns a duplex stream': function(done) {
    var input = 'abcde';

    var tasks = [
      function() {
        var gzip = require('zlib').createGzip;
        return gzip();
      },
      function() {
        var gunzip = require('zlib').createGunzip;
        return gunzip();
      }
    ];

    var flow = new Task(tasks);

    flow.input(input)
        .output(function(output) {
          console.log(output);
          assert.equal(output, 'abcde');
          done();
        }).exec();

/*
    var first = tasks[0](),
        last = tasks[1](),
        result = '';

    first.pipe(last);

    last.on('data', function(chunk) {
      result += chunk;
    });
    last.on('end', function() {
      console.log(result);
      done();
    });

    first.write(input);
    first.end();
    */
  },

  'task is a child_process followed by a function': function(done) {
    var input = 'abcdef',
        tasks = [
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          },
          function c(input) {
            return 'c' + input.trim() + 'c';
          }
        ];

    var flow = new Task(tasks);

    flow.input(input)
        .output(function(output) {
          console.log(output);
          assert.equal(output, 'c6c');
          done();
        }).exec();

    /*
    var result = '',
        task = tasks[0]();
    task.stdout.on('data', function(chunk) {
      result += chunk;
    });
    task.stdout.on('end', function() {
      var value = tasks[1](result);
      console.log(value);
      done();
    });
    task.stdin.write(input);
    task.stdin.end();
    */
  },

  'task is a function followed by a stream': function(done) {
    var input = 'aa',
        tasks = [
          function c(input) {
            return 'b' + input.trim() + 'b';
          },
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          },
        ];

    var flow = new Task(tasks);

    flow.input(input)
        .output(function(output) {
          console.log(output.trim());
          assert.equal(output.trim(), '4');
          done();
        }).exec();

    /*
    var result = '',
        task = tasks[1]();
    task.stdout.on('data', function(chunk) {
      result += chunk;
    });
    task.stdout.on('end', function() {
      console.log(result);
      done();
    });
    task.stdin.write(tasks[0](input));
    task.stdin.end();
    */
  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
