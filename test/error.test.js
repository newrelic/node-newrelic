/*global before:false beforeEach:false after:false afterEach:false describe:false it:false*/
var logger  = require('../lib/logger')
  , config  = require('../lib/config.default')
  , error   = require('../lib/error')
  ;

function createTransaction(code) {
  return { statusCode : code };
}

describe('error delivery', function () {
  var service;

  beforeEach(function (done) {
    service = new error.ErrorService(logger, config.config);

    return done();
  });

  it('should send the correct number of errors', function (done) {
    var errors = [1, 2, 3, 4, 5];

    service.onSendError(errors);
    service.getErrors().length.should.equal(5, '5 errors on the queue after the first submission');

    service.onSendError(errors);
    service.getErrors().length.should.equal(10, '10 errors on the queue after the second submission');

    service.onSendError(errors);
    service.onSendError(errors);
    service.onSendError([3,4,5,6,6,6,6,6]); // we're over the max here.
    service.getErrors().length.should.equal(20, '20 errors on the queue after overflowing the submission queue');

    return done();
  });

  it('should handle errors properly for transactions', function (done) {
    service.onTransactionFinished(createTransaction(400));
    service.onTransactionFinished(createTransaction(500));

    service.getErrorCount().should.equal(2, "error count returned by error service should match length of error array");
    service.getErrors().length.should.equal(2, "error array length should match count returned by error service");

    return done();
  });

  it('should ignore 404 errors for transactions', function (done) {
    service.onTransactionFinished(createTransaction(400));
    // 404 errors are ignored by default
    service.onTransactionFinished(createTransaction(404));
    service.onTransactionFinished(createTransaction(404));
    service.onTransactionFinished(createTransaction(404));
    service.onTransactionFinished(createTransaction(404));

    service.getErrorCount().should.equal(1, "transaction error count should ignore 404s");

    return done();
  });
});
