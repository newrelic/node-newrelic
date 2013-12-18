'use strict';

var path = require('path')
  , test = require('tap').test
  , fork = require('child_process').fork
  ;

/*
 *
 * CONSTANTS
 *
 */
var COMPLETION = 27;

test("Express 3 async throw", function (t) {
  var erk = fork(path.join(__dirname, 'erk.js'));
  var timer;

  erk.on('error', function (error) {
    t.fail(error);
    t.end();
  });

  erk.on('exit', function (code) {
    clearTimeout(timer);
    t.notEqual(code, COMPLETION, "request didn't complete");
    t.end();
  });

  // wait for the child vm to boot
  erk.on('message', function (message) {
    if (message === 'ready') {
      timer = setTimeout(function () {
        t.fail("hung waiting for exit");
        erk.kill();
      }, 1000);
      // timer.unref is only 0.9+
      if (timer.unref) timer.unref();
      erk.send(COMPLETION);
    }
  });
});
