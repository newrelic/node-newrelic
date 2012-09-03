'use strict';

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  , config       = require(path.join(__dirname, '..', 'lib', 'config.default'))
  , ErrorService = require(path.join(__dirname, '..', 'lib', 'error'))
  , Transaction  = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

function createTransaction(code) {
  return { statusCode : code };
}

describe("ErrorService", function () {
  var service;

  beforeEach(function () {
    service = new ErrorService(config.config);
  });

  it("should send the correct number of errors", function () {
    var errors = [1, 2, 3, 4, 5];

    service.onSendError(errors);
    expect(service.errors.length).equal(5);

    service.onSendError(errors);
    expect(service.errors.length).equal(10);

    service.onSendError(errors);
    service.onSendError(errors);
    service.onSendError([3,4,5,6,6,6,6,6]); // we're over the max here.
    expect(service.errors.length).equal(20);
  });

  it("should handle errors properly for transactions", function () {
    service.onTransactionFinished(createTransaction(400));
    service.onTransactionFinished(createTransaction(500));

    expect(service.errorCount).equal(2);
    expect(service.errors.length).equal(2);
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

  describe("with a service unavailable (503) error", function () {
    var agent
      , scope
      , error
      ;

    before(function () {
      service = new ErrorService(config.config);

      agent = helper.loadMockedAgent();
      var transaction = new Transaction(agent);
      scope = transaction.measureWeb('/test-request/zxrkbl', 503, 5, 5);
      transaction.end();

      service.onTransactionFinished(transaction);
      error = service.errors[0];
    });

    after(function () {
      helper.unloadAgent(agent);
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

  it("should put transactions in domains");
});
