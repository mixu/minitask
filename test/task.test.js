var fs = require('fs'),
    assert = require('assert'),
    Task = require('minitask').Task;

var Duplex = require('./lib/duplex.js');

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
          },
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          }
        ],
      flow = new Task(tasks);

    flow.input(input)
        .output(function(output) {
          console.log(output.trim());
          assert.equal(output.trim(), '2'); // 1 + newline
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
  },

  // All pairs: sync, async, child_process, pipe
  //
  // sa as cs ps
  // sc ac ca pa
  // sp ap cp pc

  'sync first task': {

    beforeEach: function() {
      this.tasks = [
        function c(input) {
          return 'b' + input.trim() + 'b';
        }];
    },

    'async second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function c(input, done) {
            setTimeout(function() {
              done(null, 'c' + input + 'c');
            }, 10);
          }
        );
        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'cbaabc');
              done();
            }).exec();
    },

    'child_process second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          });

        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), '4');
              done();
            }).exec();
    },

    'pipe second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function() {
            return new Duplex();
          });

        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'QQbaabQQ');
              done();
            }).exec();
    }
  },

  'async first task': {

    beforeEach: function() {
      this.tasks = [
        function c(input, done) {
          setTimeout(function() {
            done(null, 'c' + input + 'c');
          }, 10);
        }];
    },

    'sync second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function b(input) {
            return 'bb' + input + 'bb';
          });

        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output);
              assert.equal(output, 'bbcaacbb');
              done();
            }).exec();
    },

    'child_process second task': function(done) {
        var input = 'aaa';
        this.tasks.push(
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          });

        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), '5');
              done();
            }).exec();
    },

    'pipe second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function() {
            return new Duplex();
          });

        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'QQcaacQQ');
              done();
            }).exec();
    }

  },

  'child_process first task': {

    beforeEach: function() {
      this.tasks = [
        function() {
          var spawn = require('child_process').spawn;
          return spawn('wc', [ '-c']);
        }];
    },

    'sync second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function b(input) {
            return 'bb' + input.trim() + 'bb';
          });

        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output);
              assert.equal(output, 'bb2bb');
              done();
            }).exec();

    },

    'async second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function c(input, done) {
            setTimeout(function() {
              done(null, 'c' + input.trim() + 'c');
            }, 10);
          }
        );
        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'c2c');
              done();
            }).exec();
    },

    'pipe second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function() {
            return new Duplex();
          });

        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'QQ2QQ');
              done();
            }).exec();
    }

  },

  'pipe first task': {

    beforeEach: function() {
      this.tasks = [
        function() {
          return new Duplex();
        }];
    },

    'sync second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function b(input) {
            return 'bb' + input.trim() + 'bb';
          });

        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output);
              assert.equal(output, 'bbQQaaQQbb');
              done();
            }).exec();
    },

    'async second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function c(input, done) {
            setTimeout(function() {
              done(null, 'c' + input.trim() + 'c');
            }, 10);
          }
        );
        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'cQQaaQQc');
              done();
            }).exec();
    },

    'child_process second task': function(done) {
        var input = 'aa';
        this.tasks.push(
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          });

        var flow = new Task(this.tasks);

        flow.input(input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), '6');
              done();
            }).exec();
    }
  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--bail', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
