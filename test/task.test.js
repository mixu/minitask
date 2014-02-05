var fs = require('fs'),
    assert = require('assert'),
    Task = require('minitask').Task;

var Duplex = require('./lib/duplex.js');

var fixDir = __dirname + '/fixtures',
    tmpDir = __dirname + '/tmp';

module.exports['basic'] = {

  'functions that are not streaming and not asynchronous': function(done) {
    var input = 'a',
        events = [];

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
        })
        .on('exec', function() {
          events.push('exec');
        })
        .once('done', function() {
          // assert events
          assert.deepEqual(events, [ 'exec' ]);
        })
        .exec();
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

  'test pipe -> sync -> pipe -> pipe': function(done) {
    // there was a bug in how this specific case was handled
    // I'm guessing the first pipe() post sync was piped()
    // into the last pipe, but then we only wrote into the last pipe

    var tasks = [
          function c(input) {
            return 'c' + input + 'c';
          },
          function() {
            var spawn = require('child_process').spawn;
            return spawn('wc', [ '-c']);
          }
      ],
      flow = new Task(tasks);

    fs.writeFileSync(fixDir + '/bar.txt', 'bar.txt\n');

    flow.input(fs.createReadStream(fixDir + '/bar.txt'))
        .output(fs.createWriteStream(tmpDir + '/result2.txt'))
        .once('done', function() {
          assert.equal(fs.readFileSync(tmpDir + '/result2.txt').toString(), '10\n');
          done();
        })
        .exec();
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

    fs.writeFileSync(fixDir + '/bar.txt', 'bar.txt\n');

    flow.input(fs.createReadStream(fixDir + '/bar.txt'))
        .output(function(output) {
          assert.equal(output, 'aabar.txtaa');
          done();
        }).exec();
  },

  'output is a fs.createWriteStream': function(done) {
    var flow = new Task([ syncFn ]);

    fs.writeFileSync(fixDir + '/bar.txt', 'bar.txt\n');

    flow.input(fs.createReadStream(fixDir + '/bar.txt'))
        .output(fs.createWriteStream(tmpDir + '/result.txt'))
        .once('done', function() {
          assert.equal(fs.readFileSync(tmpDir + '/result.txt').toString(), 'bbbar.txtbb');
          done();
        })
        .exec();
  },

  'all pipes': function(done) {
    var flow = new Task([
        function() {
          var spawn = require('child_process').spawn;
          return spawn('wc', [ '-c']);
        }
      ]);

    fs.writeFileSync(fixDir + '/bar.txt', 'bar.txt\n');

    flow.input(fs.createReadStream(fixDir + '/bar.txt'))
        .output(fs.createWriteStream(tmpDir + '/result2.txt'))
        .once('done', function() {
          assert.equal(fs.readFileSync(tmpDir + '/result2.txt').toString(), '8\n');
          done();
        }).exec();
  }

};

// reused across the different combinations

var syncFn = function(input) {
  return 'bb' + input.trim() + 'bb';
};

var asyncFn = function (input, done) {
  setTimeout(function() {
    done(null, 'c' + input.trim() + 'c');
  }, 10);
};

var childProcessFn = function() {
  var spawn = require('child_process').spawn;
  return spawn('wc', [ '-c']);
};

var pipeFn = function() {
  return new Duplex();
};

// All pairs: sync, async, child_process, pipe
//
// sa as cs ps
// sc ac ca pa
// sp ap cp pc

var all = [
  { name: 'sync + async',
    tasks: [ syncFn, asyncFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output.trim(), 'cbb'+self.value+'bbc');
      };
    }
  },
  { name: 'sync + child_process',
    tasks: [ syncFn, childProcessFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output.trim(), (self.value.length + 4).toString() );
      };
    }
  },
  { name: 'sync + pipe',
    tasks: [ syncFn, pipeFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output.trim(), 'QQbb'+self.value+'bbQQ');
      };
    }
  },
  { name: 'async + sync',
    tasks: [ asyncFn, syncFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output, 'bbc'+self.value+'cbb');
      };
    }
  },
  { name: 'async + child_process',
    tasks: [ asyncFn, childProcessFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output.trim(), (self.value.length + 2).toString());
      };
    }
  },
  { name: 'child_process + sync',
    tasks: [ childProcessFn, syncFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output, 'bb'+ (self.value.length + 1) +'bb');
      };
    }
  },
  { name: 'child_process + async',
    tasks: [ childProcessFn, asyncFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output.trim(), 'c'+(self.value.length + 1) +'c');
      };
    }
  },
  { name: 'child_process + pipe',
    tasks: [ childProcessFn, pipeFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output.trim(), 'QQ'+(self.value.length + 1) +'QQ');
      };
    }
  },
  { name: 'pipe + sync',
    tasks: [ pipeFn, syncFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output, 'bbQQ'+self.value+'QQbb');
      };
    }
  },
  { name: 'pipe + async',
    tasks: [ pipeFn, asyncFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output.trim(), 'cQQ'+self.value+'QQc');
      };
    }
  },
  { name: 'pipe + child_process',
    tasks: [ pipeFn, childProcessFn ],
    assert: function(self) {
      return function(output) {
        self.assertions++;
        assert.equal(output.trim(), (self.value.length + 4).toString() );
      };
    }
  }
];

// generate tests

exports['input is a string;'] = {
  before: function() {
    this.input = 'ABCDE\n';
    this.value = 'ABCDE';
  }
};
all.forEach(function(test) {
  exports['input is a string;'][test.name] = function(done) {
      var self = this;
      self.assertions = 0;
      new Task(test.tasks)
          .input(this.input)
          .output(function(output) {
            (test.assert(self))(output);
            assert.ok(self.assertions == 1);
          })
          .once('done', function() { done(); })
          .exec();
  };
});

exports['input is a stream;'] = {
  beforeEach: function(done) {
    this.input = fs.createReadStream(fixDir + '/bar.txt');
    this.input.pause();
    this.value = 'bar.txt';

    process.nextTick(done);
  }
};
all.forEach(function(test) {
  exports['input is a stream;'][test.name] = function(done) {
      var self = this;
      self.assertions = 0;
      new Task(test.tasks)
          .input(this.input)
          .output(function(output) {
            (test.assert(self))(output);
            assert.ok(self.assertions == 1);
          })
          .once('done', function() { done(); })
          .exec();
  };
});


// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--bail', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
