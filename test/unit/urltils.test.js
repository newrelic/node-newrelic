'use strict'

var chai = require('chai')
var expect = chai.expect
var urltils = require('../../lib/util/urltils.js')
var url = require('url')


describe('NR URL utilities', function () {
  describe('scrubbing URLs', function () {
    it('should return "/" if there\'s no leading slash on the path', function () {
      expect(urltils.scrub('?t_u=http://some.com/o/p')).equal('/')
    })
  })

  describe('parsing parameters', function () {
    it('should find empty object of params in url lacking query', function () {
      expect(urltils.parseParameters('/favicon.ico')).deep.equal({})
    })

    it('should find v param in url containing ?v with no value', function () {
      expect(urltils.parseParameters('/status?v')).deep.equal({v:true})
    })

    it('should find v param with value in url containing ?v=1', function () {
      expect(urltils.parseParameters('/status?v=1')).deep.equal({v:'1'})
    })

    it('should find v param when passing in an object', function () {
      expect(urltils.parseParameters(url.parse('/status?v=1', true))).deep.equal({v:'1'})
    })
  })

  describe('determining whether an HTTP status code is an error', function () {
    var config = {error_collector : {ignore_status_codes : []}}

    it('should not throw when called with no params', function () {
      expect(function () { urltils.isError(); }).not.throws()
    })

    it('should not throw when called with no code', function () {
      expect(function () { urltils.isError(config); }).not.throws()
    })

    it('should not throw when config is missing', function () {
      expect(function () { urltils.isError(null, 200); }).not.throws()
    })

    it('should NOT mark an OK request as an error', function () {
      return expect(urltils.isError(config, 200)).false
    })

    it('should NOT mark a permanent redirect as an error', function () {
      return expect(urltils.isError(config, 301)).false
    })

    it('should NOT mark a temporary redirect as an error', function () {
      return expect(urltils.isError(config, 303)).false
    })

    it('should mark a bad request as an error', function () {
      return expect(urltils.isError(config, 400)).true
    })

    it('should mark an unauthorized request as an error', function () {
      return expect(urltils.isError(config, 401)).true
    })

    it('should mark a "payment required" request as an error', function () {
      return expect(urltils.isError(config, 402)).true
    })

    it('should mark a forbidden request as an error', function () {
      return expect(urltils.isError(config, 403)).true
    })

    it('should mark a not found request as an error', function () {
      return expect(urltils.isError(config, 404)).true
    })

    it('should mark a request with too long a URI as an error', function () {
      return expect(urltils.isError(config, 414)).true
    })

    it('should mark a method not allowed request as an error', function () {
      return expect(urltils.isError(config, 405)).true
    })

    it('should mark a request with unacceptable types as an error', function () {
      return expect(urltils.isError(config, 406)).true
    })

    it('should mark a request requiring proxy auth as an error', function () {
      return expect(urltils.isError(config, 407)).true
    })

    it('should mark a timed out request as an error', function () {
      return expect(urltils.isError(config, 408)).true
    })

    it('should mark a conflicted request as an error', function () {
      return expect(urltils.isError(config, 409)).true
    })

    it('should mark a request for a disappeared resource as an error', function () {
      return expect(urltils.isError(config, 410)).true
    })

    it('should mark a request with a missing length as an error', function () {
      return expect(urltils.isError(config, 411)).true
    })

    it('should mark a request with a failed precondition as an error', function () {
      return expect(urltils.isError(config, 412)).true
    })

    it('should mark a too-large request as an error', function () {
      return expect(urltils.isError(config, 413)).true
    })

    it('should mark a request for an unsupported media type as an error', function () {
      return expect(urltils.isError(config, 415)).true
    })

    it('should mark a request for an unsatisfiable range as an error', function () {
      return expect(urltils.isError(config, 416)).true
    })

    it('should mark a request with a failed expectation as an error', function () {
      return expect(urltils.isError(config, 417)).true
    })

    it('should mark a request asserting teapotness as an error', function () {
      return expect(urltils.isError(config, 418)).true
    })

    it('should mark a request with timed-out auth as an error', function () {
      return expect(urltils.isError(config, 419)).true
    })

    it('should mark a request for enhanced calm (brah) as an error', function () {
      return expect(urltils.isError(config, 420)).true
    })

    it('should work with strings', function () {
      var config = {error_collector : {ignore_status_codes : [403]}}
      expect(urltils.isError(config, '200')).false()
      expect(urltils.isError(config, '403')).false()
      return expect(urltils.isError(config, '404')).true()
    })
  })

  describe('getHeadersFromHeaderString', function () {
    it('should return an object of header name and value pairs from a header string', function () {
      var exampleInput = 'HTTP/1.1 404 Not Found\r\nX-Powered-By: Express\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: 45\r\nETag: W/"2d-+O+7jmB3UqTatBnw6I80rQ"\r\nDate: Tue, 23 Feb 2016 19:52:05 GMT\r\nConnection: keep-alive\r\n\r\n'
      var output = urltils.getHeadersFromHeaderString(exampleInput)
      var expectedOutput = { '52': '05 GMT',
        'X-Powered-By': 'Express',
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': '45',
        ETag: 'W/"2d-+O+7jmB3UqTatBnw6I80rQ"',
        Connection: 'keep-alive'
      }
      expect(output).deep.equal(expectedOutput)
    })
  })

  describe('isIgnoredError', function() {
    var config = {error_collector : {ignore_status_codes : []}}

    it('returns true if the status code is an HTTP error and is in the ignored list', function() {
      var errorCodes = [400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419, 420, 500, 503]
      var statusCode

      for (var i = 0; i < errorCodes.length; i++) {
        statusCode = errorCodes[i]
        expect(urltils.isIgnoredError(config, statusCode)).equal(false)
      }

      for (var i = 0; i < errorCodes.length; i++) {
        statusCode = errorCodes[i]
        config.error_collector.ignore_status_codes = [statusCode]
        expect(urltils.isIgnoredError(config, statusCode)).equal(true)
      }
    })

    it('returns false if the status code is NOT an HTTP error', function() {
      var statusCodes = [200]
      var statusCode

      for (var i = 0; i < statusCodes.length; i++) {
        statusCode = statusCodes[i]
        expect(urltils.isIgnoredError(config, statusCode)).equal(false)
      }

      for (var i = 0; i < statusCodes.length; i++) {
        statusCode = statusCodes[i]
        config.error_collector.ignore_status_codes = [statusCode]
        expect(urltils.isIgnoredError(config, statusCode)).equal(false)
      }
    })
  })

  describe('copying parameters from a query hash', function () {
    var config
      , source
      , dest


    beforeEach(function () {
      config = {
        capture_params : true,
        ignored_params : []
      }
      source = {}
      dest = {}
    })

    it('shouldn not throw on missing configuration', function () {
      expect(function () { urltils.copyParameters(null, source, dest); }).not.throws()
    })

    it('should not throw on missing source', function () {
      expect(function () { urltils.copyParameters(config, null, dest); }).not.throws()
    })

    it('should not throw on missing destination', function () {
      expect(function () { urltils.copyParameters(config, source, null); }).not.throws()
    })

    it('should copy parameters from source to destination', function () {
      dest.existing = 'here'
      source.firstNew = 'present'
      source.secondNew = 'accounted for'

      expect(function () { urltils.copyParameters(config, source, dest); }).not.throws()

      expect(dest).eql({
        existing  : 'here',
        firstNew  : 'present',
        secondNew : 'accounted for'
      })
    })

    it('should not copy ignored parameters', function () {
      dest.existing = 'here'
      source.firstNew = 'present'
      source.secondNew = 'accounted for'
      source.password = 'hamchunx'

      config.ignored_params.push('firstNew')
      config.ignored_params.push('password')

      urltils.copyParameters(config, source, dest)

      expect(dest).eql({
        existing  : 'here',
        // NOPE: firstNew  : 'present',
        secondNew : 'accounted for'
        // NOPE: password : '******'
      })
    })

    it('should not overwrite existing parameters in destination', function () {
      dest.existing = 'here'
      dest.firstNew = 'already around'
      source.firstNew = 'present'
      source.secondNew = 'accounted for'

      urltils.copyParameters(config, source, dest)

      expect(dest).eql({
        existing  : 'here',
        firstNew  : 'already around',
        secondNew : 'accounted for'
      })
    })

    it('should not overwrite null parameters in destination', function () {
      dest.existing = 'here'
      dest.firstNew = null
      source.firstNew = 'present'

      urltils.copyParameters(config, source, dest)

      expect(dest).eql({
        existing  : 'here',
        firstNew  : null
      })
    })

    it('should not overwrite undefined parameters in destination', function () {
      dest.existing = 'here'
      dest.firstNew = undefined
      source.firstNew = 'present'

      urltils.copyParameters(config, source, dest)

      expect(dest).eql({
        existing  : 'here',
        firstNew  : undefined
      })
    })
  })
})
