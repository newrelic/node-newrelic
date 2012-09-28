'use strict';

var path    = require('path')
  , tap     = require('tap')
  , test    = tap.test
  , mysql   = require('mysql')
  , shimmer = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  , helper  = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  ;

test("MySQL instrumentation should find the MySQL call in the transaction trace",
     function (t) {
  t.plan(2);

  var agent = helper.loadMockedAgent();
  shimmer.bootstrapInstrumentation(agent);

  helper.bootstrapMySQL(function (error, app) {
    if (error) return t.fail(error);

    t.ok(true, "tests go here");

    helper.cleanMySQL(app, function done() {
      t.ok(true, "cleanup tests go here");

      helper.unloadAgent(agent);
      t.end();
    });
  });
});
