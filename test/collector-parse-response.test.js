'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , parse  = require(path.join(__dirname, '..', 'lib', 'collector', 'parse-response.js'))
  ;

describe("collector response parser", function () {
  it("should throw if called without a collector method name", function () {
    var response = {statusCode : 200};
    function callback() {}

    expect(function () {
      parse(undefined, response, callback);
    }).throws('collector method name required!');
  });

  it("should throw if called without a response", function () {
    function callback() {}

    expect(function () {
      parse('TEST', undefined, callback);
    }).throws('HTTP response required!');
  });

  it("should throw if called without a callback", function () {
    var response = {statusCode : 200};

    expect(function () {
      parse('TEST', response, undefined);
    }).throws('callback required!');
  });

  describe("when initialized properly and response status is 200", function () {
    var response = {statusCode : 200}
      , methodName = 'TEST'
      ;

    it("should pass through return value", function (done) {
      function callback(error, returned) {
        expect(returned).eql([1,1,2,3,5,8]);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{"return_value":[1,1,2,3,5,8]}');
    });

    it("should pass through even a null return value", function (done) {
      function callback(error, returned) {
        expect(returned).equal(null);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{"return_value":null}');
    });

    it("shouldn't error on an explicitly null return value", function (done) {
      function callback(error) {
        should.not.exist(error);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{"return_value":null}');
    });

    it("shouldn't error in normal situations", function (done) {
      function callback(error) {
        should.not.exist(error);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{"return_value":[1,1,2,3,5,8]}');
    });

    it("should error on a missing body", function (done) {
      function callback(error) {
        expect(error.message).equal('No body found in response to TEST.');
        should.not.exist(error.laterErrors);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, null);
    });

    it("should error on no return value or server exception", function (done) {
      function callback(error) {
        expect(error.message).equal('No data found in response to TEST.');
        should.not.exist(error.laterErrors);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{}');
    });

    it("should error on a server exception", function (done) {
      function callback(error) {
        expect(error.message).equal('whoops');
        should.not.exist(error.laterErrors);
        done();
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(null, exception);
    });

    it("shouldn't error on a server exception with no error type", function (done) {
      function callback(error) {
        expect(error.message).equal('whoops');
        should.not.exist(error.class);
        should.not.exist(error.laterErrors);
        done();
      }

      var exception = '{"exception":{"message":"whoops"}}';

      var parser = parse(methodName, response, callback);
      parser(null, exception);
    });

    it("should use a generic message for server exception without one", function (done) {
      function callback(error) {
        expect(error.message).equal('New Relic internal error');
        should.not.exist(error.laterErrors);
        done();
      }

      var exception = '{"exception":{"error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(null, exception);
    });

    it("shouldn't error on a server exception with no error message", function (done) {
      function callback(error) {
        expect(error.class).equal('RuntimeError');
        should.not.exist(error.laterErrors);
        done();
      }

      var exception = '{"exception":{"error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(null, exception);
    });

    it("should pass back passed in errors before missing body errors", function (done) {
      function callback(error) {
        expect(error.message).equal('oh no!');
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), null);
    });

    it("should pass back passed in errors but retain body error", function (done) {
      function callback(error) {
        expect(error.laterErrors.length).equal(1);
        expect(error.laterErrors[0].message).equal("No body found in response to TEST.");
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), null);
    });

    it("should pass back passed in errors before parse errors", function (done) {
      function callback(error) {
        expect(error.message).equal('oh no!');
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), 'uhhh');
    });

    it("should pass back passed in errors but retain parse errors", function (done) {
      function callback(error) {
        expect(error.laterErrors.length).equal(1);
        expect(error.laterErrors[0].message).equal("Unexpected token u");
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), 'uhhh');
    });

    it("should pass back passed in errors before collector exceptions", function (done) {
      function callback(error) {
        expect(error.message).equal('oh no!');
        done();
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), exception);
    });

    it("should pass back passed in errors but retain collector errors", function (done) {
      function callback(error) {
        expect(error.laterErrors.length).equal(1);
        expect(error.laterErrors[0].message).equal('whoops');
        done();
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), exception);
    });

    it("should set the status code on any errors passed in", function (done) {
      function callback(error) {
        expect(error.statusCode).equal(200);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), null);
    });

    it("should set error class on a server exception", function (done) {
      function callback(error) {
        expect(error.class).equal('RuntimeError');
        should.not.exist(error.laterErrors);
        done();
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(null, exception);
    });
  });

  describe("when initialized properly and response status is 503", function () {
    var response = {statusCode : 503}
      , methodName = 'TEST'
      ;

    it("should pass through return value despite weird status code", function (done) {
      function callback(error, returned) {
        expect(returned).eql([1,1,2,3,5,8]);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{"return_value":[1,1,2,3,5,8]}');
    });

    it("should return value despite weird code and server exception", function (done) {
      function callback(error, returned) {
        expect(returned).eql([1,1,2,3,5,8]);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{"return_value":[1,1,2,3,5,8],"exception":{"message":"uh"}}');
    });

    it("should pass server exception before status code", function (done) {
      function callback(error) {
        expect(error.message).equal('uh');
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{"return_value":[1,1,2,3,5,8],"exception":{"message":"uh"}}');
    });

    it("should pass server exception but retain status code", function (done) {
      function callback(error) {
        expect(error.laterErrors.length).equal(1);
        expect(error.laterErrors[0].message).equal('Got HTTP 503 in response to TEST.');
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{"return_value":[1,1,2,3,5,8],"exception":{"message":"uh"}}');
    });

    it("should error because status code is weird", function (done) {
      function callback(error) {
        expect(error.message).equal('Got HTTP 503 in response to TEST.');
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{"return_value":[1,1,2,3,5,8]}');
    });

    it("should error on a missing body", function (done) {
      function callback(error) {
        expect(error.message).equal('No body found in response to TEST.');
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, null);
    });

    it("should error on no return value or server exception", function (done) {
      function callback(error) {
        expect(error.message).equal('Got HTTP 503 in response to TEST.');
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{}');
    });

    // a little weird, but we already know the response is strange due to status code
    it("should have no later errors on no return or exception", function (done) {
      function callback(error) {
        should.not.exist(error.laterErrors);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(null, '{}');
    });

    it("should error on a server exception", function (done) {
      function callback(error) {
        expect(error.message).equal('whoops');
        done();
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(null, exception);
    });

    it("shouldn't error on a server exception with no error type", function (done) {
      function callback(error) {
        expect(error.message).equal('whoops');
        should.not.exist(error.class);
        done();
      }

      var exception = '{"exception":{"message":"whoops"}}';

      var parser = parse(methodName, response, callback);
      parser(null, exception);
    });

    it("should error w/status code for server exception w/no message", function (done) {
      function callback(error) {
        expect(error.message).equal('Got HTTP 503 in response to TEST.');
        done();
      }

      var exception = '{"exception":{"error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(null, exception);
    });

    it("shouldn't error on a server exception with no error message", function (done) {
      function callback(error) {
        expect(error.class).equal('RuntimeError');
        done();
      }

      var exception = '{"exception":{"error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(null, exception);
    });

    it("should pass back passed in errors before missing body errors", function (done) {
      function callback(error) {
        expect(error.message).equal('oh no!');
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), null);
    });

    it("should pass back passed in errors before parse errors", function (done) {
      function callback(error) {
        expect(error.message).equal('oh no!');
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), 'uhhh');
    });

    it("should pass back passed in errors before collector exceptions", function (done) {
      function callback(error) {
        expect(error.message).equal('oh no!');
        done();
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), exception);
    });

    it("should set the status code on any errors passed in", function (done) {
      function callback(error) {
        expect(error.statusCode).equal(503);
        done();
      }

      var parser = parse(methodName, response, callback);
      parser(new Error('oh no!'), null);
    });

    it("should set error class on a server exception", function (done) {
      function callback(error) {
        expect(error.class).equal('RuntimeError');
        done();
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}';

      var parser = parse(methodName, response, callback);
      parser(null, exception);
    });
  });
});
