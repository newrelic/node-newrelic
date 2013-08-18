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

  before(function () {
    fs = require('fs');
    readdir = fs.readdir;
    fs.readdir = readstub;
  });

  beforeEach(function () {
    agent = helper.instrumentMockedAgent();
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  after(function () {
    fs.readdir = readdir;
  });

  describe("shouldn't cause bootstrapping to fail", function () {
    var initialize;

    before(function () {
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'core', 'fs'));
    });

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws();
    });

    it("when passed an empty module", function () {
      expect(function () { initialize(agent, {}); }).not.throws();
    });
  });

  it("should pick up scope when called in a scoped transaction");

  it("should add a metric segment when called as part of a transaction", function (done) {
    helper.runInTransaction(agent, function transactionInScope() {
      fs.readdir('stub', function (error) {
        if (error) return done(error); // habits die hard

        var transaction = agent.getTransaction();
        should.exist(transaction, "should find transaction inside readdir");

        agent.once('transactionFinished', function () {
          var metric = agent.metrics.getMetric('Filesystem/ReadDir/stub');
          should.exist(metric);

          expect(metric.callCount).equal(1);

          return done();
        });

        transaction.end();
      });
    });
  });

  it("shouldn't crash when called outside of transaction", function (done) {
    expect(function nonTransactionalReaddir() {
      fs.readdir('stub', function (error, files) {
        if (error) return done(error);

        expect(files).eql([]);

        return done();
      });
    }).not.throws();
  });

  describe("with error monitor", function () {
    var mochaHandlers;

    before(function () {
      // disable mocha's error handler
      mochaHandlers = helper.onlyDomains();
    });

    after(function () {
      process._events['uncaughtException'] = mochaHandlers;
    });

    it("should have stored mocha's exception handler", function () {
      should.exist(mochaHandlers);
      expect(mochaHandlers.length).above(0);
    });

    it("should trace errors thrown from the callback", function (done) {
      // FIXME: 0.8 uses uncaughtException for domains, 0.6 has no domains. How to trap?
      var handled = false;
      process.once('uncaughtException', function () {
        if (handled) return;
        handled = true;

        var errors = agent.errors.errors; // not my finest naming scheme
        expect(errors.length).equal(1);

        return done();
      });

      helper.runInTransaction(agent, function transactionInScope() {
        fs.readdir('stub', function () {
          throw new Error("what happens here?");
        });
      });
    });

    it("should propagate traced exceptions", function (done) {
      // FIXME: 0.8 uses uncaughtException for domains, 0.6 has no domains. How to trap?
      var handled = false;
      process.once('uncaughtException', function (error) {
        if (handled) return;
        handled = true;

        expect(error.message).equal("ohno");

        return done();
      });

      helper.runInTransaction(agent, function transactionInScope() {
        fs.readdir('stub', function () {
          throw new Error("ohno");
        });
      });
    });
  });
});
