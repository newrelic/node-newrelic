'use strict'

const chai = require('chai')
const expect = chai.expect
const should = chai.should()
const parse = require('../../../lib/collector/parse-response')


describe('collector response parser', () => {
  it('should call back with an error if called with no collector method name', (done) => {
    parse(null, {statusCode: 200}, (err) => {
      expect(err)
        .to.be.an.instanceOf(Error)
        .and.have.property('message', 'collector method name required!')
      done()
    })
  })

  it('should call back with an error if called without a response', (done) => {
    parse('TEST', null, (err) => {
      expect(err)
        .to.be.an.instanceOf(Error)
        .and.have.property('message', 'HTTP response required!')
      done()
    })
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
      function callback(error, res) {
        expect(res.payload).eql([1,1,2,3,5,8])
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":[1,1,2,3,5,8]}')
    })

    it('should pass through status code', (done) => {
      function callback(error, res) {
        expect(res.status).eql(200)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":[1,1,2,3,5,8]}')
    })

    it('should pass through even a null return value', (done) => {
      function callback(error, res) {
        expect(res.payload).equal(null)
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

    it('should not error on a missing body', (done) => {
      function callback(error, res) {
        expect(error).to.be.null
        expect(res.status).eql(200)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, null)
    })

    it('should not error on unparsable return value', (done) => {
      function callback(error, res) {
        expect(error).to.be.null
        expect(res.payload).to.be.null
        expect(res.status).to.equal(200)
        done()
      }

      var exception = '<html><body>hi</body></html>'

      var parser = parse(methodName, response, callback)
      parser(null, exception)
    })

    it('should not error on a server exception with no error message', (done) => {
      function callback(error, res) {
        expect(error).to.be.null
        expect(res.payload).to.be.null
        expect(res.status).to.equal(200)
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
  })

  describe('when initialized properly and response status is 503', () => {
    const response = {statusCode : 503}
    const methodName = 'TEST'


    it('should pass through return value despite weird status code', (done) => {
      function callback(error, res) {
        expect(error).to.be.null
        expect(res.payload).eql([1,1,2,3,5,8])
        expect(res.status).to.equal(503)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{"return_value":[1,1,2,3,5,8]}')
    })

    it('should not error on no return value or server exception', (done) => {
      function callback(error, res) {
        expect(error).to.be.null
        expect(res.status).eql(503)
        done()
      }

      var parser = parse(methodName, response, callback)
      parser(null, '{}')
    })
  })
})
