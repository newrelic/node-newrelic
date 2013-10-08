'use strict';

var path = require('path')
  , test = require('tap').test
  ;

test("loading the application via index.js", function (t) {
  t.plan(1);

  var api;
  t.doesNotThrow(function () {
    api = require(path.join(__dirname, '..', '..', 'index.js'));
  }, "just loading the agent");

  api.agent.stop();
});
