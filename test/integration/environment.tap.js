'use strict';

var path         = require('path')
  , tap          = require('tap')
  , test         = tap.test
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config.js'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  , agent
  ;

test("Using should shouldn't cause the agent to explode on startup.", function (t) {
  t.plan(2);

  var should;
  t.doesNotThrow(function () {
    should = require('should');
    agent = new Agent(configurator.initialize());
    t.ok(agent.should);
  }, "shouldn't throw when should is included.");
});

test("Environment scraper shouldn't die if HOME isn't set.", function (t) {
  t.plan(2);

  delete process.env.HOME;

  t.notOk(process.env.HOME, "HOME has been nuked.");
  t.doesNotThrow(function () {
    agent = new Agent(configurator.initialize());
  }, "shouldn't throw just because HOME isn't set");
});
