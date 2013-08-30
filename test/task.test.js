var fs = require('fs'),
    assert = require('assert');

module.exports['basic'] = {

  'functions that are not streaming and not asynchronous': function() {
    var input = 'a';

    function b(input) {
      return 'bb' + input + 'bb';
    }

    function c(input) {
      return 'c' + input + 'c';
    }

    var tasks = [
      b, c
    ];

    var result = tasks.reduce(function(prev, task) {
      return task(prev);
    }, input);

    console.log(result);
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

    var tasks = [
      b, c
    ];

    var i = 0;

    function next(err, input) {
      if(i < tasks.length) {
        tasks[i](input, function(err, input) {
          next(err, input);
        });
        i++;
      } else {
        onDone(null, input);
      }
    }
    next(null, input);

    function onDone(err, result) {
      console.log(result);
      done();
    }
  },

  'task is a function that returns an object with .stdout and .stdin': function(done) {
    var input = 'abcdef';

    var tasks = [
      function() {
        var spawn = require('child_process').spawn;
        return spawn('wc', [ '-c']);
      }
    ];

    var duplex = tasks[0](),
        result = '';

    duplex.stdout.on('data', function(chunk) {
      result += chunk;
    });
    duplex.stdout.on('end', function() {
      console.log(result);
      done();
    });
    duplex.stdin.write(input);
    duplex.stdin.end();
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
  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
