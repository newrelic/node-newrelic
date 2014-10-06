'use strict'

var path         = require('path')
  , url          = require('url')
  , chai         = require('chai')
  , expect       = chai.expect
  , should       = chai.should()
  , RemoteMethod = require('../../lib/collector/remote-method.js')


function generate(method, runID) {
  var fragment = '/agent_listener/invoke_raw_method?' +
    'marshal_format=json&protocol_version=12&' +
    'license_key=license%20key%20here&method=' + method

  if (runID) fragment += '&run_id=' + runID

  return fragment
}

describe("RemoteMethod", function () {
  it("should require a name for the method to call", function () {
    var method
    expect(function () { method = new RemoteMethod(); }).throws()
  })

  it("should expose a call method as its public API", function () {
    expect(new RemoteMethod('test').invoke).a('function')
  })

  it("should expose its name", function () {
    expect(new RemoteMethod('test').name).equal('test')
  })

  describe("_safeRequest", function () {
    var method
      , options


    beforeEach(function () {
      method = new RemoteMethod('test')
      options = {
        host       : 'collector.newrelic.com',
        port       : 80,
        onError    : function error() {},
        onResponse : function response() {},
        body       : [],
        path       : '/nonexistent'
      }
    })

    it("requires an options hash", function () {
      expect(function () { method._safeRequest(); })
        .throws("Must include options to make request!")
    })

    it("requires a collector hostname", function () {
      delete options.host
      expect(function () { method._safeRequest(options); })
        .throws("Must include collector hostname!")
    })

    it("requires a collector port", function () {
      delete options.port
      expect(function () { method._safeRequest(options); })
        .throws("Must include collector port!")
    })

    it("requires an error callback", function () {
      delete options.onError
      expect(function () { method._safeRequest(options); })
        .throws("Must include error handler!")
    })

    it("requires a response callback", function () {
      delete options.onResponse
      expect(function () { method._safeRequest(options); })
        .throws("Must include response handler!")
    })

    it("requires a request body", function () {
      delete options.body
      expect(function () { method._safeRequest(options); })
        .throws("Must include body to send to collector!")
    })

    it("requires a request URL", function () {
      delete options.path
      expect(function () { method._safeRequest(options); })
        .throws("Must include URL to request!")
    })
  })

  describe("when calling a method on the collector", function () {
    it("should pass error to the callback when serialization fails", function (done) {
      var config = {
        port : 80,
        host : 'collector.newrelic.com'
      }

      var method = new RemoteMethod('test', config)

      var problematic = {}
      problematic.parent = problematic

      method.invoke(problematic, function (error) {
        expect(error.message).equal('Converting circular structure to JSON')
        done()
      })
    })

    it("shouldn't throw when dealing with compressed data", function (done) {
      var method = new RemoteMethod('test', {host : 'localhost'})
      method._shouldCompress = function () { return true; }
      method._safeRequest = function (options) {
        expect(options.body.readUInt8(0)).equal(120)
        expect(options.body.length).equal(14)

        return done()
      }

      method.invoke('data')
    })

    it("shouldn't throw when preparing uncompressed data", function (done) {
      var method = new RemoteMethod('test', {host : 'localhost'})
      method._safeRequest = function (options) {
        expect(options.body).equal('"data"')

        return done()
      }

      method.invoke('data')
    })
  })

  describe("when the connection fails", function () {
    it("should return the connection failure", function (done) {
      var method = new RemoteMethod('TEST', {host : 'localhost', port : 8765})
      method.invoke({message : 'none'}, function (error) {
        should.exist(error)
        expect(error.message).equal('connect ECONNREFUSED')

        done()
      })
    })

    it("should correctly handle a DNS lookup failure", function (done) {
      var method = new RemoteMethod('TEST', {host : 'failed.domain.cxlrg', port : 80})
      method.invoke([], function (error) {
        should.exist(error)

        // https://github.com/joyent/node/commit/7295bb9435c
        expect(error.message).match(/^getaddrinfo E(NOENT|NOTFOUND)$/)

        done()
      })
    })
  })

  describe("when posting to collector", function () {
    var RUN_ID = 1337
      , URL    = 'http://collector.newrelic.com'
      , nock
      , method
      , sendMetrics


    before(function () {
      // order dependency: requiring nock at the top of the file breaks other tests
      nock = require('nock')
      nock.disableNetConnect()
    })

    after(function () {
      nock.enableNetConnect()
    })

    beforeEach(function () {
      var config = {
        host        : 'collector.newrelic.com',
        port        : 80,
        run_id      : RUN_ID,
        license_key : 'license key here'
      }
      method = new RemoteMethod('metric_data', config)
    })

    it("should pass through error when compression fails", function (done) {
      var method = new RemoteMethod('test', {host : 'localhost'})
      method._shouldCompress = function () { return true; }
      // zlib.deflate really wants a stringlike entity
      method._post(-1, function (error) {
        should.exist(error)

        done()
      })
    })

    describe("successfully", function () {
      beforeEach(function () {
        // nock ensures the correct URL is requested
        sendMetrics = nock(URL)
                        .post(generate('metric_data', RUN_ID))
                        .reply(200, {return_value : []})
      })

      it("should invoke the callback without error", function (done) {
        method._post('[]', function (error) {
          should.not.exist(error)
          done()
        })
      })

      it("should use the right URL", function (done) {
        method._post('[]', function () {
          expect(sendMetrics.isDone()).equal(true)
          done()
        })
      })

      it("should not throw when compressing", function (done) {
        method._shouldCompress = function () { return true }
        method._post('abc', function (error) {
          expect(sendMetrics.isDone()).equal(true)
          done()
        })
      })
    })

    describe("unsuccessfully", function () {
      beforeEach(function () {
        // whoops
        sendMetrics = nock(URL).post(generate('metric_data', RUN_ID)).reply(500)
      })

      it("should invoke the callback with an error", function (done) {
        method._post('[]', function (error) {
          should.exist(error)

          done()
        })
      })

      it("should say what the error was", function (done) {
        method._post('[]', function (error) {
          expect(error.message).equal("No body found in response to metric_data.")

          done()
        })
      })

      it("should include the status code on the error", function (done) {
        method._post('[]', function (error) {
          expect(error.statusCode).equal(500)

          done()
        })
      })
    })

    describe("and parsing response", function () {
      describe("that indicated success", function () {
        var getRedirectHost
          , response = {
              return_value : 'collector-42.newrelic.com'
            }


        beforeEach(function () {
          var config = {
            host        : 'collector.newrelic.com',
            port        : 80,
            license_key : 'license key here'
          }
          method = new RemoteMethod('get_redirect_host', config)

          getRedirectHost = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, response)
        })

        it("shouldn't error", function (done) {
          method.invoke(undefined, function (error) {
            should.not.exist(error)

            done()
          })
        })

        it("should find the expected value", function (done) {
          method.invoke(undefined, function (error, host) {
            expect(host).equal('collector-42.newrelic.com')

            done()
          })
        })

        it("shouldn't alter the sent JSON", function (done) {
          method.invoke(undefined, function (error, host, json) {
            expect(json).eql(response)

            done()
          })
        })
      })

      describe("that indicated a New Relic error", function () {
        var metricData
        var response = {
          exception : {
            message    : "Configuration has changed, need to restart agent.",
            error_type : "NewRelic::Agent::ForceRestartException"
          }
        }

        beforeEach(function () {
          metricData = nock(URL)
                         .post(generate('metric_data', RUN_ID))
                         .reply(200, response)

        })

        it("should set error message to the JSON's message", function (done) {
          method.invoke([], function (error) {
            expect(error.message)
              .equal("Configuration has changed, need to restart agent.")

            done()
          })
        })

        it("should pass along the New Relic error type", function (done) {
          method.invoke([], function (error) {
            expect(error.class).equal('NewRelic::Agent::ForceRestartException')

            done()
          })
        })

        it("should include the HTTP status code for the response", function (done) {
          method.invoke([], function (error) {
            expect(error.statusCode).equal(200)

            done()
          })
        })

        it("shouldn't alter the sent JSON", function (done) {
          method.invoke(undefined, function (error, host, json) {
            expect(json).eql(response)

            done()
          })
        })
      })
    })
  })

  describe("when generating headers for a plain request", function () {
    var headers

    beforeEach(function () {
      var config = {
        host       : 'collector.newrelic.com',
        port       : '80',
        run_id     : 12
      }
      var body = 'test☃'
      var method = new RemoteMethod(body, config)

      headers = method._headers(body, false)
    })

    it("should use the content type from the parameter", function () {
      expect(headers["CONTENT-ENCODING"]).equal("identity")
    })

    it("should generate the content length from the body parameter", function () {
      expect(headers["Content-Length"]).equal(7)
    })

    it("should use a keepalive connection", function () {
      expect(headers.Connection).equal("Keep-Alive")
    })

    it("should have the host from the configuration", function () {
      expect(headers.Host).equal("collector.newrelic.com")
    })

    it("should tell the server we're sending JSON", function () {
      expect(headers["Content-Type"]).equal("application/json")
    })

    it("should have a user-agent string", function () {
      expect(headers["User-Agent"]).not.equal(undefined)
    })
  })

  describe("when generating headers for a compressed request", function () {
    var headers

    beforeEach(function () {
      var config = {
        host       : 'collector.newrelic.com',
        port       : '80',
        run_id     : 12
      }
      var body = 'test☃'
      var method = new RemoteMethod(body, config)

      headers = method._headers(body, true)
    })

    it("should use the content type from the parameter", function () {
      expect(headers["CONTENT-ENCODING"]).equal("deflate")
    })

    it("should generate the content length from the body parameter", function () {
      expect(headers["Content-Length"]).equal(7)
    })

    it("should use a keepalive connection", function () {
      expect(headers.Connection).equal("Keep-Alive")
    })

    it("should have the host from the configuration", function () {
      expect(headers.Host).equal("collector.newrelic.com")
    })

    it("should tell the server we're sending JSON", function () {
      expect(headers["Content-Type"]).equal("application/octet-stream")
    })

    it("should have a user-agent string", function () {
      expect(headers["User-Agent"]).not.equal(undefined)
    })
  })

  describe("when generating a request URL", function () {
    var TEST_RUN_ID  = Math.floor(Math.random() * 3000)
      , TEST_METHOD  = 'TEST_METHOD'
      , TEST_LICENSE = 'hamburtson'
      , config
      , parsed


    function reconstitute(generated) {
      return url.parse(generated, true, false)
    }

    beforeEach(function () {
      config = {
        host        : 'collector.newrelic.com',
        port        : 80,
        license_key : TEST_LICENSE
      }
      var method = new RemoteMethod(TEST_METHOD, config)
      parsed = reconstitute(method._path())
    })

    it("should say that it supports protocol 12", function () {
      expect(parsed.query.protocol_version).equal('12')
    })

    it("should tell the collector it's sending JSON", function () {
      expect(parsed.query.marshal_format).equal('json')
    })

    it("should pass through the license key", function () {
      expect(parsed.query.license_key).equal(TEST_LICENSE)
    })

    it("should include the method", function () {
      expect(parsed.query.method).equal(TEST_METHOD)
    })

    it("shouldn't include the agent run ID when not set", function () {
      var method = new RemoteMethod(TEST_METHOD, config)
      parsed = reconstitute(method._path())
      should.not.exist(parsed.query.run_id)
    })

    it("should include the agent run ID when set", function () {
      config.run_id = TEST_RUN_ID
      var method = new RemoteMethod(TEST_METHOD, config)
      parsed = reconstitute(method._path())
      expect(parsed.query.run_id).equal('' + TEST_RUN_ID)
    })

    it("should start with the (old-style) path", function () {
      expect(parsed.pathname.indexOf('/agent_listener/invoke_raw_method')).equal(0)
    })
  })

  describe("when generating the User-Agent string", function () {
    var TEST_VERSION = '0-test'
      , ua


    before(function () {
      var config = {version : '0-test'}
        , method = new RemoteMethod('test', config)


      ua = method._userAgent()
    })

    it("should clearly indicate it's New Relic for Node", function () {
      expect(ua).include('NewRelic-NodeAgent')
    })

    it("should include the agent version", function () {
      expect(ua).include(TEST_VERSION)
    })

    it("should include node's version", function () {
      expect(ua).include(process.versions.node)
    })

    it("should include node's platform and architecture", function () {
      expect(ua).include(process.platform + '-' + process.arch)
    })
  })
})
