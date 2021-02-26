/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const url = require('url')
const chai = require('chai')
const expect = chai.expect
const should = chai.should()
const Config = require('../../../lib/config')
const RemoteMethod = require('../../../lib/collector/remote-method')


function generate(method, runID, protocolVersion) {
  protocolVersion = protocolVersion || 17
  var fragment = '/agent_listener/invoke_raw_method?' +
    `marshal_format=json&protocol_version=${protocolVersion}&` +
    `license_key=license%20key%20here&method=${method}`

  if (runID) fragment += `&run_id=${runID}`

  return fragment
}

describe('RemoteMethod', () => {
  let mockHeaders

  beforeEach(() => {
    mockHeaders = {}
  })

  it('should require a name for the method to call', () => {
    expect(() => {
      new RemoteMethod() // eslint-disable-line no-new
    }).throws()
  })

  it('should expose a call method as its public API', () => {
    expect(new RemoteMethod('test').invoke).a('function')
  })

  it('should expose its name', () => {
    expect(new RemoteMethod('test').name).equal('test')
  })

  it('should default to protocol 17', function() {
    expect(new RemoteMethod('test')._protocolVersion).equal(17)
  })

  describe('serialize', function() {
    var method = null

    beforeEach(() => {
      method = new RemoteMethod('test')
    })

    it('should JSON-encode the given payload', (done) => {
      method.serialize({foo: 'bar'}, (err, encoded) => {
        expect(err).to.not.exist
        expect(encoded).to.equal('{"foo":"bar"}')
        done()
      })
    })

    it('should not error with circular payloads', (done) => {
      const obj = {foo: 'bar'}
      obj.obj = obj
      method.serialize(obj, (err, encoded) => {
        expect(err).to.not.exist
        expect(encoded).to.equal('{"foo":"bar","obj":"[Circular ~]"}')
        done()
      })
    })

    describe('with a bad payload', () => {
      it('should catch serialization errors', (done) => {
        method.serialize({toJSON: () => {
          throw new Error('fake serialization error')
        }}, (err, encoded) => {
          expect(err)
            .to.exist
            .and.have.property('message', 'fake serialization error')
          expect(encoded).to.not.exist
          done()
        })
      })
    })
  })

  describe('_safeRequest', () => {
    let method
    let options

    beforeEach(() => {
      method = new RemoteMethod('test', {max_payload_size_in_bytes: 100}, {})
      options = {
        host: 'collector.newrelic.com',
        port: 80,
        onError: () => {},
        onResponse: () => {},
        body: [],
        path: '/nonexistent'
      }
    })

    it('requires an options hash', () => {
      expect(() => { method._safeRequest() })
        .throws('Must include options to make request!')
    })

    it('requires a collector hostname', () => {
      delete options.host
      expect(() => { method._safeRequest(options) })
        .throws('Must include collector hostname!')
    })

    it('requires a collector port', () => {
      delete options.port
      expect(() => { method._safeRequest(options) })
        .throws('Must include collector port!')
    })

    it('requires an error callback', () => {
      delete options.onError
      expect(() => { method._safeRequest(options) })
        .throws('Must include error handler!')
    })

    it('requires a response callback', () => {
      delete options.onResponse
      expect(() => { method._safeRequest(options) })
        .throws('Must include response handler!')
    })

    it('requires a request body', () => {
      delete options.body
      expect(() => { method._safeRequest(options) })
        .throws('Must include body to send to collector!')
    })

    it('requires a request URL', () => {
      delete options.path
      expect(() => { method._safeRequest(options) })
        .throws('Must include URL to request!')
    })

    it('requires a request body within the maximum payload size limit', () => {
      options.body = 'a'.repeat(method._config.max_payload_size_in_bytes + 1)
      expect(() => { method._safeRequest(options) })
        .throws('Maximum payload size exceeded')
    })
  })

  describe('when calling a method on the collector', () => {
    it('should not throw when dealing with compressed data', (done) => {
      const method = new RemoteMethod('test', {}, {host: 'localhost'})
      method._shouldCompress = () => true
      method._safeRequest = (options) => {
        expect(options.body.readUInt8(0)).equal(120)
        expect(options.body.length).equal(14)

        return done()
      }

      method.invoke('data', mockHeaders)
    })

    it('should not throw when preparing uncompressed data', (done) => {
      const method = new RemoteMethod('test', {}, {host: 'localhost'})
      method._safeRequest = (options) => {
        expect(options.body).equal('"data"')

        return done()
      }

      method.invoke('data', mockHeaders)
    })
  })

  describe('when the connection fails', () => {
    it('should return the connection failure', (done) => {
      const config = {
        max_payload_size_in_bytes: 100000
      }

      const endpoint = {
        host: 'localhost',
        port: 8765
      }

      const method = new RemoteMethod('TEST', config, endpoint)
      method.invoke({message: 'none'}, mockHeaders, (error) => {
        should.exist(error)
        expect(error.message).equal('connect ECONNREFUSED 127.0.0.1:8765')

        done()
      })
    })

    it('should correctly handle a DNS lookup failure', (done) => {
      const config = {
        max_payload_size_in_bytes: 100000
      }
      const endpoint = {
        host: 'failed.domain.cxlrg',
        port: 80
      }
      const method = new RemoteMethod('TEST', config, endpoint)
      method.invoke([], mockHeaders, (error) => {
        should.exist(error)

        // https://github.com/joyent/node/commit/7295bb9435c
        expect(error.message).match(
          /^getaddrinfo E(NOENT|NOTFOUND)( failed.domain.cxlrg)?( failed.domain.cxlrg:80)?$/ // eslint-disable-line max-len
        )

        done()
      })
    })
  })

  describe('when posting to collector', () => {
    const RUN_ID = 1337
    const URL = 'https://collector.newrelic.com'
    let nock = null
    let config = null
    let method = null
    let sendMetrics = null

    before(() => {
      // order dependency: requiring nock at the top of the file breaks other tests
      nock = require('nock')
      nock.disableNetConnect()
    })

    after(() => {
      nock.enableNetConnect()
    })

    beforeEach(() => {
      config = new Config({
        ssl: true,
        run_id: RUN_ID,
        license_key: 'license key here'
      })

      const endpoint = {
        host: 'collector.newrelic.com',
        port: 443
      }

      method = new RemoteMethod('metric_data', config, endpoint)
    })

    afterEach(() => {
      config = null
      method = null
      nock.cleanAll()
    })

    it('should pass through error when compression fails', (done) => {
      method = new RemoteMethod('test', {}, {host: 'localhost'})
      method._shouldCompress = () => true
      // zlib.deflate really wants a stringlike entity
      method._post(-1, mockHeaders, (error) => {
        should.exist(error)

        done()
      })
    })

    describe('successfully', () => {
      beforeEach(() => {
        // nock ensures the correct URL is requested
        sendMetrics = nock(URL)
          .post(generate('metric_data', RUN_ID))
          .matchHeader('Content-Encoding', 'identity')
          .reply(200, {return_value: []})
      })

      it('should invoke the callback without error', (done) => {
        method._post('[]', mockHeaders, (error) => {
          should.not.exist(error)
          done()
        })
      })

      it('should use the right URL', (done) => {
        method._post('[]', mockHeaders, (error) => {
          should.not.exist(error)
          expect(sendMetrics.isDone()).to.be.true
          done()
        })
      })

      it('should respect the put_for_data_send config', (done) => {
        nock.cleanAll()
        const putMetrics = nock(URL)
          .put(generate('metric_data', RUN_ID))
          .reply(200, {return_value: []})

        config.put_for_data_send = true
        method._post('[]', mockHeaders, (error) => {
          should.not.exist(error)
          expect(putMetrics.isDone()).to.be.true
          done()
        })
      })

      describe('with compression', () => {
        let sendDeflatedMetrics
        let sendGzippedMetrics

        beforeEach(() => {
          sendDeflatedMetrics = nock(URL)
            .post(generate('metric_data', RUN_ID))
            .matchHeader('Content-Encoding', 'deflate')
            .reply(200, {return_value: []})

          sendGzippedMetrics = nock(URL)
            .post(generate('metric_data', RUN_ID))
            .matchHeader('Content-Encoding', 'gzip')
            .reply(200, {return_value: []})
        })

        it('should default to deflated compression', (done) => {
          method._shouldCompress = () => true
          method._post('[]', mockHeaders, (error) => {
            should.not.exist(error)
            expect(sendMetrics.isDone()).to.be.false
            expect(sendDeflatedMetrics.isDone()).to.be.true
            expect(sendGzippedMetrics.isDone()).to.be.false
            done()
          })
        })

        it('should respect the compressed_content_encoding config', (done) => {
          config.compressed_content_encoding = 'gzip'
          method._shouldCompress = () => true
          method._post('[]', mockHeaders, (error) => {
            should.not.exist(error)
            expect(sendMetrics.isDone()).to.be.false
            expect(sendDeflatedMetrics.isDone()).to.be.false
            expect(sendGzippedMetrics.isDone()).to.be.true
            done()
          })
        })
      })
    })

    describe('unsuccessfully', () => {
      beforeEach(() => {
        // nock ensures the correct URL is requested
        sendMetrics = nock(URL)
          .post(generate('metric_data', RUN_ID))
          .reply(500, {return_value: []})
      })

      it('should invoke the callback without error', (done) => {
        method._post('[]', mockHeaders, (error) => {
          should.not.exist(error)
          done()
        })
      })

      it('should include status code in response', (done) => {
        method._post('[]', mockHeaders, (error, response) => {
          should.not.exist(error)
          expect(response.status).to.equal(500)
          expect(sendMetrics.isDone()).to.be.true
          done()
        })
      })
    })

    describe('with an error', () => {
      let thrown = null
      let originalSafeRequest = null

      beforeEach(() => {
        thrown = new Error('whoops!')
        originalSafeRequest = method._safeRequest
        method._safeRequest = () => {throw thrown}
      })

      afterEach(() => {
        method._safeRequest = originalSafeRequest
      })

      it('should not allow the error to go uncaught', (done) => {
        method._post('[]', null, (caught) => {
          expect(caught).to.equal(thrown)
          done()
        })
      })
    })

    describe('and parsing response', () => {
      describe('that indicated success', () => {
        const response = {
          return_value: 'collector-42.newrelic.com'
        }

        beforeEach(() => {
          config = new Config({
            ssl: true,
            license_key: 'license key here'
          })

          const endpoint = {
            host: 'collector.newrelic.com',
            port: 443
          }

          method = new RemoteMethod('preconnect', config, endpoint)

          nock(URL)
            .post(generate('preconnect'))
            .reply(200, response)
        })

        it('should not error', (done) => {
          method.invoke(null, mockHeaders, (error) => {
            should.not.exist(error)

            done()
          })
        })

        it('should find the expected value', (done) => {
          method.invoke(null, mockHeaders, (error, res) => {
            expect(res.payload).equal('collector-42.newrelic.com')

            done()
          })
        })
      })

      describe('that indicated a New Relic error', () => {
        const response = {}

        beforeEach(() => {
          nock(URL)
            .post(generate('metric_data', RUN_ID))
            .reply(409, response)
        })

        it('should include status in callback response', (done) => {
          method.invoke([], mockHeaders, (error, res) => {
            expect(error).to.be.null
            expect(res.status).equal(409)
            done()
          })
        })
      })
    })
  })

  describe('when generating headers for a plain request', () => {
    let headers
    let options
    let method

    beforeEach(() => {
      const config = new Config({
        run_id: 12
      })

      const endpoint = {
        host: 'collector.newrelic.com',
        port: '80',
      }

      const body = 'test☃'
      method = new RemoteMethod(body, config, endpoint)

      options = {
        body,
        compressed: false
      }

      headers = method._headers(options)
    })

    it('should use the content type from the parameter', () => {
      expect(headers['CONTENT-ENCODING']).equal('identity')
    })

    it('should generate the content length from the body parameter', () => {
      expect(headers['Content-Length']).equal(7)
    })

    it('should use a keepalive connection', () => {
      expect(headers.Connection).equal('Keep-Alive')
    })

    it('should have the host from the configuration', () => {
      expect(headers.Host).equal('collector.newrelic.com')
    })

    it('should tell the server we are sending JSON', () => {
      expect(headers['Content-Type']).equal('application/json')
    })

    it('should have a user-agent string', () => {
      expect(headers['User-Agent']).not.equal(undefined)
    })

    describe('with stored NR request headers', () => {
      it('should include store NR headers in outgoing request headers', () => {
        options.nrHeaders = {
          'X-NR-Run-Token': 'AFBE4546FEADDEAD1243',
          'X-NR-Metadata': '12BAED78FC89BAFE1243'
        }
        headers = method._headers(options)

        expect(headers['X-NR-Run-Token']).to.equal('AFBE4546FEADDEAD1243')
        expect(headers['X-NR-Metadata']).to.equal('12BAED78FC89BAFE1243')
      })
    })
  })

  describe('when generating headers for a compressed request', () => {
    let headers

    beforeEach(() => {
      const config = new Config({
        run_id: 12
      })

      const endpoint = {
        host: 'collector.newrelic.com',
        port: '80',
      }

      const body = 'test☃'
      const method = new RemoteMethod(body, config, endpoint)

      const options = {
        body,
        compressed: true
      }

      headers = method._headers(options)
    })

    it('should use the content type from the parameter', () => {
      expect(headers['CONTENT-ENCODING']).equal('deflate')
    })

    it('should generate the content length from the body parameter', () => {
      expect(headers['Content-Length']).equal(7)
    })

    it('should use a keepalive connection', () => {
      expect(headers.Connection).equal('Keep-Alive')
    })

    it('should have the host from the configuration', () => {
      expect(headers.Host).equal('collector.newrelic.com')
    })

    it('should tell the server we are sending JSON', () => {
      expect(headers['Content-Type']).equal('application/json')
    })

    it('should have a user-agent string', () => {
      expect(headers['User-Agent']).not.equal(undefined)
    })
  })

  describe('when generating a request URL', () => {
    const TEST_RUN_ID = Math.floor(Math.random() * 3000) + 1
    const TEST_METHOD = 'TEST_METHOD'
    const TEST_LICENSE = 'hamburtson'
    let config = null
    let endpoint = null
    let parsed = null

    function reconstitute(generated) {
      return url.parse(generated, true, false)
    }

    beforeEach(() => {
      config = new Config({
        license_key: TEST_LICENSE
      })

      endpoint = {
        host: 'collector.newrelic.com',
        port: 80
      }

      const method = new RemoteMethod(TEST_METHOD, config, endpoint)
      parsed = reconstitute(method._path())
    })

    it('should say that it supports protocol 17', () => {
      expect(parsed.query.protocol_version).equal('17')
    })

    it('should tell the collector it is sending JSON', () => {
      expect(parsed.query.marshal_format).equal('json')
    })

    it('should pass through the license key', () => {
      expect(parsed.query.license_key).equal(TEST_LICENSE)
    })

    it('should include the method', () => {
      expect(parsed.query.method).equal(TEST_METHOD)
    })

    it('should not include the agent run ID when not set', () => {
      const method = new RemoteMethod(TEST_METHOD, config, endpoint)
      parsed = reconstitute(method._path())
      should.not.exist(parsed.query.run_id)
    })

    it('should include the agent run ID when set', () => {
      config.run_id = TEST_RUN_ID
      const method = new RemoteMethod(TEST_METHOD, config, endpoint)
      parsed = reconstitute(method._path())
      expect(parsed.query.run_id).equal('' + TEST_RUN_ID)
    })

    it('should start with the (old-style) path', () => {
      expect(parsed.pathname.indexOf('/agent_listener/invoke_raw_method')).equal(0)
    })
  })

  describe('when generating the User-Agent string', () => {
    const TEST_VERSION = '0-test'
    let ua
    let version
    let pkg

    before(() => {
      pkg = require('../../../package.json')
      version = pkg.version
      pkg.version = TEST_VERSION
      const config = new Config({})
      const method = new RemoteMethod('test', config, {})

      ua = method._userAgent()
    })

    after(() => {
      pkg.version = version
    })

    it('should clearly indicate it is New Relic for Node', () => {
      expect(ua).include('NewRelic-NodeAgent')
    })

    it('should include the agent version', () => {
      expect(ua).include(TEST_VERSION)
    })

    it('should include node version', () => {
      expect(ua).include(process.versions.node)
    })

    it('should include node platform and architecture', () => {
      expect(ua).include(process.platform + '-' + process.arch)
    })
  })
})
