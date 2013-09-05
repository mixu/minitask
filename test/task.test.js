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

  'input is a fs.createReadStream': function(done) {

    function a(input, done) {
      setTimeout(function() {
        done(null, 'aa' + input.trim() + 'aa');
      }, 10);
    }

    var flow = new Task([a]);

    flow.input(fs.createReadStream('./fixtures/bar.txt'))
        .output(function(output) {
          assert.equal(output, 'aabar.txtaa');
          done();
        }).exec();
  },

  'output is a fs.createWriteStream': function(done) {

    function a(input, done) {
      setTimeout(function() {
        done(null, 'aa' + input.trim() + 'aa');
      }, 10);
    }

    var flow = new Task([a]);

    flow.input(fs.createReadStream('./fixtures/bar.txt'))
        .output(fs.createWriteStream('./tmp/result.txt')).exec(done);
  },

  'all pipes': function(done) {
    var flow = new Task([
        function() {
          var spawn = require('child_process').spawn;
          return spawn('wc', [ '-c']);
        }
      ]);

    flow.input(fs.createReadStream('./fixtures/bar.txt'))
        .output(fs.createWriteStream('./tmp/result2.txt')).exec(done);
  },

};


var allPairs = {
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
        this.tasks.push(
          function c(input, done) {
            setTimeout(function() {
              done(null, 'c' + input.trim() + 'c');
            }, 10);
          }
        );
        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'cb'+self.value+'bc');
              done();
            }).exec();
    },

    'child_process second task': function(done) {
        this.tasks.push(
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          });

        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), (self.value.length + 2).toString() );
              done();
            }).exec();
    },

    'pipe second task': function(done) {
        this.tasks.push(
          function() {
            return new Duplex();
          });

        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'QQb'+self.value+'bQQ');
              done();
            }).exec();
    }
  },

  'async first task': {

    beforeEach: function() {
      this.tasks = [
        function c(input, done) {
          setTimeout(function() {
            done(null, 'c' + input.trim() + 'c');
          }, 10);
        }];
    },

    'sync second task': function(done) {
        this.tasks.push(
          function b(input) {
            return 'bb' + input + 'bb';
          });

        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output);
              assert.equal(output, 'bbc'+self.value+'cbb');
              done();
            }).exec();
    },

    'child_process second task': function(done) {
        this.tasks.push(
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          });

        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), (self.value.length + 2).toString());
              done();
            }).exec();
    },

    'pipe second task': function(done) {
        this.tasks.push(
          function() {
            return new Duplex();
          });

        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'QQc'+self.value+'cQQ');
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
        this.tasks.push(
          function b(input) {
            return 'bb' + input.trim() + 'bb';
          });

        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output);
              assert.equal(output, 'bb'+ (self.value.length + 1) +'bb');
              done();
            }).exec();

    },

    'async second task': function(done) {
        this.tasks.push(
          function c(input, done) {
            setTimeout(function() {
              done(null, 'c' + input.trim() + 'c');
            }, 10);
          }
        );
        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'c'+(self.value.length + 1) +'c');
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
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'QQ'+(self.value.length + 1) +'QQ');
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
        this.tasks.push(
          function b(input) {
            return 'bb' + input.trim() + 'bb';
          });

        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output);
              assert.equal(output, 'bbQQ'+self.value+'QQbb');
              done();
            }).exec();
    },

    'async second task': function(done) {
        this.tasks.push(
          function c(input, done) {
            setTimeout(function() {
              done(null, 'c' + input.trim() + 'c');
            }, 10);
          }
        );
        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), 'cQQ'+self.value+'QQc');
              done();
            }).exec();
    },

    'child_process second task': function(done) {
        this.tasks.push(
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          });

        var flow = new Task(this.tasks);
        var self = this;

        flow.input(this.input)
            .output(function(output) {
              console.log(output.trim());
              assert.equal(output.trim(), (self.value.length + 4).toString() );
              done();
            }).exec();
    }
  }

};

// generate tests
exports['input is a string;'] = {
  before: function() {
    this.input = 'ABCDE\n';
    this.value = 'ABCDE';
  }
};
Object.keys(allPairs).forEach(function(key) {
  exports['input is a string;'][key] = allPairs[key];
});

exports['input is a stream;'] = {
  beforeEach: function(done) {
    this.input = fs.createReadStream('./fixtures/bar.txt');
    this.input.pause();

    this.input.on('data', function(chunk) {
      console.log('IN data', '' +chunk);
    });
    this.input.once('close', function() {
      console.log('IN close');
    });
    this.input.once('error', function(e) {
        throw e;
    });
    this.input.once('end', function(chunk) {
      console.log('IN end');
    });

    this.value = 'bar.txt';

    process.nextTick(done);
  }
};
Object.keys(allPairs).forEach(function(key) {
  exports['input is a stream;'][key] = allPairs[key];
});


// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--bail', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
