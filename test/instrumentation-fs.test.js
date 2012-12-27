'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

function readstub(dirname, callback) {
  process.nextTick(function () { // readdir is async
    callback(null, []);
  });
}

describe("built-in fs module instrumentation", function () {
  var fs
    , readdir
    , agent
    ;

  beforeEach(function () {
    fs = require('fs');
    readdir = fs.readdir;
    fs.readdir = readstub;

    agent = helper.instrumentMockedAgent();
  });

  afterEach(function () {
    helper.unloadAgent(agent);
    fs.readdir = readdir;
  });

  it("should pick up scope when called in a scoped transaction");

  it("should add a metric segment when called as part of a transaction", function (done) {
    helper.runInTransaction(agent, function transactionInScope() {
      fs.readdir('stub', function (error, files) {
        if (error) return done(error); // habits die hard

        var transaction = agent.getTransaction();
        agent.once('transactionFinished', function () {
          var metric = agent.metrics.getMetric('Filesystem/ReadDir/stub');
          should.exist(metric);

          var stats = metric.stats;
          should.exist(stats);
          expect(stats.callCount).equal(1);

          return done();
        });

        transaction.end();
      });
    });
  });

  describe("with error monitor", function () {
    var mochaHandler;

    before(function () {
      mochaHandler = process.listeners('uncaughtException').pop();
    });

    after(function () {
      process.on('uncaughtException', mochaHandler);
    });

    it("should trap errors thrown by the instrumentation in the error tracer", function (done) {
      process.once('uncaughtException', function () {
        var errors = agent.errors.errors; // not my finest naming scheme
        expect(errors.length).equal(1);

        return done();
      });

      helper.runInTransaction(agent, function transactionInScope() {
        fs.readdir('stub', function (error, files) {
          throw new Error("what happens here?");
        });
      });
    });

    it("should propagate traced exceptions", function (done) {
      process.once('uncaughtException', function (error) {
        expect(error.message).equal("ohno");

        return done();
      });

      helper.runInTransaction(agent, function transactionInScope() {
        fs.readdir('stub', function (error, files) {
          throw new Error("ohno");
        });
      });
    });
  });
});
