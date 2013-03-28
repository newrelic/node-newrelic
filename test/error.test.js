'use strict';

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , should       = chai.should()
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  , config       = require(path.join(__dirname, '..', 'lib', 'config.default'))
  , dominion     = require(path.join(__dirname, '..', 'lib', 'dominion'))
  , ErrorTracer  = require(path.join(__dirname, '..', 'lib', 'error'))
  , Transaction  = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

function createTransaction(code) {
  return { statusCode : code, exceptions : [] };
}

describe("ErrorTracer", function () {
  var service;

  beforeEach(function () {
    service = new ErrorTracer(config.config);
  });

  it("shouldn't gather errors if it's switched off", function () {
    var error = new Error('this error will never be seen');
    service.config.error_collector.enabled = false;

    expect(service.errorCount).equal(0);
    expect(service.errors.length).equal(0);

    service.add(error);

    expect(service.errorCount).equal(1);
    expect(service.errors.length).equal(0);

    service.config.error_collector.enabled = true;
  });

  it("should retain a maximum of 20 errors to send", function () {
    for (var i = 0; i < 5; i++) service.add(null, new Error('filling the queue'));
    expect(service.errors.length).equal(5);

    for (i = 0; i < 5; i++) service.add(null, new Error('more filling the queue'));
    expect(service.errors.length).equal(10);

    // this will take the tracer 3 over the limit of 20
    for (i = 0; i < 13; i++) service.add(null, new Error('overfilling the queue'));
    expect(service.errorCount).equal(23);
    expect(service.errors.length).equal(20);
  });

  it("should handle errors properly for transactions", function () {
    service.onTransactionFinished(createTransaction(400));
    service.onTransactionFinished(createTransaction(500));

    expect(service.errors.length).equal(2);
    expect(service.errorCount).equal(2);
  });

  it("should ignore 404 errors for transactions", function () {
    service.onTransactionFinished(createTransaction(400));
    // 404 errors are ignored by default
    service.onTransactionFinished(createTransaction(404));
    service.onTransactionFinished(createTransaction(404));
    service.onTransactionFinished(createTransaction(404));
    service.onTransactionFinished(createTransaction(404));

    expect(service.errorCount).equal(1);
  });

  describe("with an internal server error (500) and an exception", function () {
    var agent
      , scope
      , error
      ;

    beforeEach(function () {
      agent = helper.loadMockedAgent();
      service = agent.errors;

      var transaction = new Transaction(agent)
        , exception   = new Error('500 test error')
        ;

      transaction.exceptions.push(exception);
      scope = transaction.measureWeb('/test-request/zxrkbl', 500, 5, 5);
      transaction.end();

      error = service.errors[0];
    });

    afterEach(function () {
      helper.unloadAgent(agent);
    });

    it("should properly reset when finished", function () {
      expect(service.errorCount).equal(1);

      service.clear();
      expect(service.errorCount).equal(0);
    });

    it("should associate errors with the transaction's scope", function () {
      var errorScope = error[1];

      expect(errorScope).equal(scope);
    });

    it("should associate errors with a message", function () {
      var message = error[2];

      expect(message).match(/500 test error/);
    });

    it("should associate errors with a message class", function () {
      var messageClass = error[3];

      expect(messageClass).equal('Error');
    });

    it("should associate errors with parameters", function () {
      var params = error[4];

      expect(params).eql({request_uri : "/test-request/zxrkbl"});
    });
  });

  describe("with a service unavailable (503) error", function () {
    var agent
      , scope
      , error
      ;

    beforeEach(function () {
      agent = helper.loadMockedAgent();
      service = agent.errors;

      var transaction = new Transaction(agent);
      scope = transaction.measureWeb('/test-request/zxrkbl', 503, 5, 5);
      transaction.end();

      error = service.errors[0];
    });

    afterEach(function () {
      helper.unloadAgent(agent);
    });

    it("should properly reset when finished", function () {
      expect(service.errorCount).equal(1);

      service.clear();
      expect(service.errorCount).equal(0);
    });

    it("should associate errors with the transaction's scope", function () {
      var errorScope = error[1];

      expect(errorScope).equal(scope);
    });

    it("should associate errors with a message", function () {
      var message = error[2];

      expect(message).equal('HttpError 503');
    });

    it("should associate errors with a message class", function () {
      var messageClass = error[3];

      expect(messageClass).equal('HttpError 503');
    });

    it("should associate errors with parameters", function () {
      var params = error[4];

      expect(params).deep.equal({request_uri : "/test-request/zxrkbl"});
    });
  });

  describe("when monitoring function application for errors", function () {
    var transaction;

    beforeEach(function () {
      var agent = helper.loadMockedAgent();
      transaction = new Transaction(agent);
    });

    it("should rethrow the exception", function () {
      var testFunction = function () {
        var uninitialized;
        uninitialized.explosion.happens.here = "fabulous";
      };

      expect(function () {
        service.monitor(testFunction, transaction);
      }).throws(TypeError);
    });

    it("should return the correct value", function () {
      var safeFunction = function (val) {
        return val * val;
      };

      expect(service.monitor(safeFunction.bind(null, 3), transaction)).equal(9);
    });
  });

  if (dominion.available) {
    describe("when domains are available", function () {
      var mochaHandlers
        , agent
        , domain
        , active
        , json
        ;

      before(function (done) {
        agent = helper.loadMockedAgent();

        /**
         * Mocha is extremely zealous about trapping errors, and runs each test
         * in a try / catch block. To get the exception to propagate out to the
         * domain's uncaughtException handler, we need to put the test in an
         * asynchronous context and break out of the mocha jail.
         */
        process.nextTick(function () {
          // disable mocha's error handler
          mochaHandlers = helper.onlyDomains();

          process.once('uncaughtException', function () {
            json = agent.errors.errors[0];

            return done();
          });

          var disruptor = agent.tracer.transactionProxy(function () {
            domain = agent.getTransaction().trace.domain;
            active = process.domain;

            // trigger the domain
            throw new Error('sample error');
          });

          disruptor();
        });
      });

      after(function () {
        // ...but be sure to re-enable mocha's error handler
        process._events['uncaughtException'] = mochaHandlers;
      });

      it("should put transactions in domains", function () {
        should.exist(domain);
        should.exist(active);
        expect(domain).equal(active);
      });

      it("should find a single error", function () {
        expect(agent.errors.errors.length).equal(1);
      });

      describe("when handed an error from a domain", function () {
        it("should find the error", function () {
          should.exist(json);
        });

        it("should have 5 elements in the trace", function () {
          expect(json.length).equal(5);
        });

        it("should always have a 0 (ignored) timestamp", function () {
          expect(json[0]).equal(0);
        });

        it("should have the default ('Unknown') scope", function () {
          expect(json[1]).equal('Unknown');
        });

        it("should have the error's message", function () {
          expect(json[2]).match(/^Error: sample error/);
        });

        it("should have the error's constructor name (class)", function () {
          expect(json[3]).equal('Error');
        });

        it("should default to empty parameters", function () {
          expect(json[4]).deep.equal({});
        });
      });
    });

  }
});
