'use strict';

var path = require('path')
  , mysql = require('mysql')
  , shimmer = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  , helper = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  ;

describe("MySQL instrumentation", function () {
  var agent
    , architecture
    ;

  before(function (done) {
    this.timeout(20 * 1000);
    agent = helper.loadMockedAgent();
    shimmer.bootstrapInstrumentation(agent);

    helper.bootstrapMySQL(function (error, app) {
      if (error) return done(error);

      architecture = app;
      return done();
    });
  });

  after(function (done) {
    helper.unloadAgent(agent);
    helper.cleanMySQL(architecture, done);
  });

  it("should find the MySQL call in the transaction trace");
});
