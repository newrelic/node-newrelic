'use strict';

var path  = require('path')
  , tap   = require('tap')
  , test  = tap.test
  , Agent = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  , agent
  ;

test("Environment scraper shouldn't die if HOME isn't set.", function (t) {
  t.plan(2);

  delete process.env.HOME;

  t.notOk(process.env.HOME, "HOME has been nuked.");
  t.doesNotThrow(function () {
    agent = new Agent();
  }, "shouldn't throw just because HOME isn't set");
});
