'use strict'

const chai = require('chai')
const expect = chai.expect
const should = chai.should()
const parse = require('../../../lib/collector/parse-response')
const semver = require('semver')


describe('collector response parser', () => {
  it('should throw if called without a collector method name', () => {
    var response = {statusCode : 200}
    function callback() {}

    expect(() => {
      parse(undefined, response, callback)
    }).throws('collector method name required!')
  })

  it('should throw if called without a response', () => {
    function callback() {}

    expect(() => {
      parse('TEST', undefined, callback)
    }).throws('HTTP response required!')
  })

  it('should throw if called without a callback', () => {
    var response = {statusCode : 200}

    expect(() => {
      parse('TEST', response, undefined)
    }).throws('callback required!')
  })

  describe('when initialized properly and response status is 200', () => {
    const response = {statusCode : 200}
    const methodName = 'TEST'


    it('should pass through return value', (done) => {
      function callback(error, returned) {
        expect(returned).eql([1,1,2,3,5,8])
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":[1,1,2,3,5,8]}')
    })

    it('should pass through even a null return value', (done) => {
      function callback(error, returned) {
        expect(returned).equal(null)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":null}')
    })

    it('should not error on an explicitly null return value', (done) => {
      function callback(error) {
        should.not.exist(error)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":null}')
    })

    it('should not error in normal situations', (done) => {
      function callback(error) {
        should.not.exist(error)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":[1,1,2,3,5,8]}')
    })

    it('should error on a missing body', (done) => {
      function callback(error) {
        expect(error.message).equal('No body found in response to TEST.')
        should.not.exist(error.laterErrors)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, null)
    })

    it('should error on no return value or server exception', (done) => {
      function callback(error) {
        expect(error.message).equal('No data found in response to TEST.')
        should.not.exist(error.laterErrors)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{}')
    })

    it('should error on a server exception', (done) => {
      function callback(error) {
        expect(error.message).equal('whoops')
        should.not.exist(error.laterErrors)
        done()
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })

    it('should not error on a server exception with no error type', (done) => {
      function callback(error) {
        expect(error.message).equal('whoops')
        should.not.exist(error.class)
        should.not.exist(error.laterErrors)
        done()
      }

      var exception = '{"exception":{"message":"whoops"}}'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })

    it('should use a generic message for server exception without one', (done) => {
      function callback(error) {
        expect(error.message).equal('New Relic internal error')
        should.not.exist(error.laterErrors)
        done()
      }

      var exception = '{"exception":{"error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })

    it('should use a specific error message when parsing fails', (done) => {
      function callback(error) {
        var expectedErrorMessage = 'Unexpected token <'
        if (semver.satisfies(process.versions.node, '>=6.0.0')) {
          expectedErrorMessage = 'Unexpected token < in JSON at position 0'
        }
        expect(error.message).equal(expectedErrorMessage)
        should.not.exist(error.laterErrors)
        done()
      }

      var exception = '<html><body>hi</body></html>'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })

    it('should not error on a server exception with no error message', (done) => {
      function callback(error) {
        expect(error.class).equal('RuntimeError')
        should.not.exist(error.laterErrors)
        done()
      }

      var exception = '{"exception":{"error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })

    it('should pass back passed in errors before missing body errors', (done) => {
      function callback(error) {
        expect(error.message).equal('oh no!')
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), null)
    })

    it('should pass back passed in errors but retain body error', (done) => {
      function callback(error) {
        expect(error.laterErrors.length).equal(1)
        expect(error.laterErrors[0].message).equal("No body found in response to TEST.")
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), null)
    })

    it('should pass back passed in errors before parse errors', (done) => {
      function callback(error) {
        expect(error.message).equal('oh no!')
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), 'uhhh')
    })

    it('should pass back passed in errors but retain parse errors', (done) => {
      function callback(error) {
        expect(error.laterErrors.length).equal(1)

        var expectedErrorMessage = 'Unexpected token u'
        if (semver.satisfies(process.versions.node, '>=6.0.0')) {
          expectedErrorMessage = 'Unexpected token u in JSON at position 0'
        }

        expect(error.laterErrors[0].message).equal(expectedErrorMessage)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), 'uhhh')
    })

    it('should pass back passed in errors before collector exceptions', (done) => {
      function callback(error) {
        expect(error.message).equal('oh no!')
        done()
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), exception)
    })

    it('should pass back passed in errors but retain collector errors', (done) => {
      function callback(error) {
        expect(error.laterErrors.length).equal(1)
        expect(error.laterErrors[0].message).equal('whoops')
        done()
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), exception)
    })

    it('should set the status code on any errors passed in', (done) => {
      function callback(error) {
        expect(error.statusCode).equal(200)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), null)
    })

    it('should set error class on a server exception', (done) => {
      function callback(error) {
        expect(error.class).equal('RuntimeError')
        should.not.exist(error.laterErrors)
        done()
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })
  })

  describe('when initialized properly and response status is 503', () => {
    const response = {statusCode : 503}
    const methodName = 'TEST'


    it('should pass through return value despite weird status code', (done) => {
      function callback(error, returned) {
        expect(returned).eql([1,1,2,3,5,8])
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":[1,1,2,3,5,8]}')
    })

    it('should return value despite weird code and server exception', (done) => {
      function callback(error, returned) {
        expect(returned).eql([1,1,2,3,5,8])
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":[1,1,2,3,5,8],"exception":{"message":"uh"}}')
    })

    it('should pass server exception before status code', (done) => {
      function callback(error) {
        expect(error.message).equal('uh')
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":[1,1,2,3,5,8],"exception":{"message":"uh"}}')
    })

    it('should pass server exception but retain status code', (done) => {
      function callback(error) {
        expect(error.laterErrors.length).equal(1)
        expect(error.laterErrors[0].message).equal('Got HTTP 503 in response to TEST.')
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":[1,1,2,3,5,8],"exception":{"message":"uh"}}')
    })

    it('should error because status code is weird', (done) => {
      function callback(error) {
        expect(error.message).equal('Got HTTP 503 in response to TEST.')
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":[1,1,2,3,5,8]}')
    })

    it('should error on a missing body', (done) => {
      function callback(error) {
        expect(error.message).equal('No body found in response to TEST.')
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, null)
    })

    it('should error on no return value or server exception', (done) => {
      function callback(error) {
        expect(error.message).equal('Got HTTP 503 in response to TEST.')
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{}')
    })

    // a little weird, but we already know the response is strange due to status code
    it('should have no later errors on no return or exception', (done) => {
      function callback(error) {
        should.not.exist(error.laterErrors)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{}')
    })

    it('should error on a server exception', (done) => {
      function callback(error) {
        expect(error.message).equal('whoops')
        done()
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })

    it('should not error on a server exception with no error type', (done) => {
      function callback(error) {
        expect(error.message).equal('whoops')
        should.not.exist(error.class)
        done()
      }

      var exception = '{"exception":{"message":"whoops"}}'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })

    it('should error w/status code for server exception w/no message', (done) => {
      function callback(error) {
        expect(error.message).equal('Got HTTP 503 in response to TEST.')
        done()
      }

      var exception = '{"exception":{"error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })

    it('should not error on a server exception with no error message', (done) => {
      function callback(error) {
        expect(error.class).equal('RuntimeError')
        done()
      }

      var exception = '{"exception":{"error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })

    it('should pass back passed in errors before missing body errors', (done) => {
      function callback(error) {
        expect(error.message).equal('oh no!')
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), null)
    })

    it('should pass back passed in errors before parse errors', (done) => {
      function callback(error) {
        expect(error.message).equal('oh no!')
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), 'uhhh')
    })

    it('should pass back passed in errors before collector exceptions', (done) => {
      function callback(error) {
        expect(error.message).equal('oh no!')
        done()
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), exception)
    })

    it('should set the status code on any errors passed in', (done) => {
      function callback(error) {
        expect(error.statusCode).equal(503)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(new Error('oh no!'), null)
    })

    it('should set error class on a server exception', (done) => {
      function callback(error) {
        expect(error.class).equal('RuntimeError')
        done()
      }

      var exception = '{"exception":{"message":"whoops","error_type":"RuntimeError"}}'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })
  })
})
