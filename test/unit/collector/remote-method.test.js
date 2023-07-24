/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const url = require('url')
const Config = require('../../../lib/config')
const RemoteMethod = require('../../../lib/collector/remote-method')
const helper = require('../../lib/agent_helper')
const { tapAssertMetrics } = require('../../lib/metrics_helper')
const NAMES = require('../../../lib/metrics/names')

const BARE_AGENT = { config: {}, metrics: { measureBytes() {} } }

function generate(method, runID, protocolVersion) {
  protocolVersion = protocolVersion || 17
  let fragment =
    '/agent_listener/invoke_raw_method?' +
    `marshal_format=json&protocol_version=${protocolVersion}&` +
    `license_key=license%20key%20here&method=${method}`

  if (runID) {
    fragment += `&run_id=${runID}`
  }

  return fragment
}

tap.test('should require a name for the method to call', (t) => {
  t.throws(() => {
    new RemoteMethod() // eslint-disable-line no-new
  })
  t.end()
})

tap.test('should require an agent for the method to call', (t) => {
  t.throws(() => {
    new RemoteMethod('test') // eslint-disable-line no-new
  })
  t.end()
})

tap.test('should expose a call method as its public API', (t) => {
  t.type(new RemoteMethod('test', BARE_AGENT).invoke, 'function')
  t.end()
})

tap.test('should expose its name', (t) => {
  t.equal(new RemoteMethod('test', BARE_AGENT).name, 'test')
  t.end()
})

tap.test('should default to protocol 17', (t) => {
  t.equal(new RemoteMethod('test', BARE_AGENT)._protocolVersion, 17)
  t.end()
})

tap.test('serialize', (t) => {
  t.autoend()

  let method = null

  t.beforeEach(() => {
    method = new RemoteMethod('test', BARE_AGENT)
  })

  t.test('should JSON-encode the given payload', (t) => {
    method.serialize({ foo: 'bar' }, (err, encoded) => {
      t.error(err)

      t.equal(encoded, '{"foo":"bar"}')
      t.end()
    })
  })

  t.test('should not error with circular payloads', (t) => {
    const obj = { foo: 'bar' }
    obj.obj = obj
    method.serialize(obj, (err, encoded) => {
      t.error(err)

      t.equal(encoded, '{"foo":"bar","obj":"[Circular ~]"}')
      t.end()
    })
  })

  t.test('should be able to handle a bigint', (t) => {
    const obj = { big: BigInt('1729') }
    method.serialize(obj, (err, encoded) => {
      t.error(err)
      t.equal(encoded, '{"big":"1729"}')
      t.end()
    })
  })

  t.test('should catch serialization errors', (t) => {
    method.serialize(
      {
        toJSON: () => {
          throw new Error('fake serialization error')
        }
      },
      (err, encoded) => {
        t.ok(err)
        t.equal(err.message, 'fake serialization error')

        t.notOk(encoded)
        t.end()
      }
    )
  })
})

tap.test('_safeRequest', (t) => {
  t.autoend()

  let method = null
  let options = null
  let agent = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()
    agent.config = { max_payload_size_in_bytes: 100 }
    method = new RemoteMethod('test', agent)
    options = {
      host: 'collector.newrelic.com',
      port: 80,
      onError: () => {},
      onResponse: () => {},
      body: [],
      path: '/nonexistent'
    }
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('requires an options hash', (t) => {
    t.throws(() => {
      method._safeRequest()
    }, new Error('Must include options to make request!'))
    t.end()
  })

  t.test('requires a collector hostname', (t) => {
    delete options.host
    t.throws(() => {
      method._safeRequest(options)
    }, new Error('Must include collector hostname!'))
    t.end()
  })

  t.test('requires a collector port', (t) => {
    delete options.port
    t.throws(() => {
      method._safeRequest(options)
    }, new Error('Must include collector port!'))
    t.end()
  })

  t.test('requires an error callback', (t) => {
    delete options.onError
    t.throws(() => {
      method._safeRequest(options)
    }, new Error('Must include error handler!'))
    t.end()
  })

  t.test('requires a response callback', (t) => {
    delete options.onResponse
    t.throws(() => {
      method._safeRequest(options)
    }, new Error('Must include response handler!'))
    t.end()
  })

  t.test('requires a request body', (t) => {
    delete options.body
    t.throws(() => {
      method._safeRequest(options)
    }, new Error('Must include body to send to collector!'))
    t.end()
  })

  t.test('requires a request URL', (t) => {
    delete options.path
    t.throws(() => {
      method._safeRequest(options)
    }, new Error('Must include URL to request!'))
    t.end()
  })

  t.test('requires a request body within the maximum payload size limit', (t) => {
    options.body = 'a'.repeat(method._config.max_payload_size_in_bytes + 1)
    t.throws(() => {
      method._safeRequest(options)
    }, new Error('Maximum payload size exceeded'))
    const { unscoped: metrics } = helper.getMetrics(agent)
    t.ok(
      metrics['Supportability/Nodejs/Collector/MaxPayloadSizeLimit/test'],
      'should log MaxPayloadSizeLimit supportability metric'
    )
    t.end()
  })
})

tap.test('when calling a method on the collector', (t) => {
  t.autoend()

  t.test('should not throw when dealing with compressed data', (t) => {
    const method = new RemoteMethod('test', BARE_AGENT, { host: 'localhost' })
    method._shouldCompress = () => true
    method._safeRequest = (options) => {
      t.equal(options.body.readUInt8(0), 31)
      t.equal(options.body.length, 26)

      t.end()
    }

    method.invoke('data', {})
  })

  t.test('should not throw when preparing uncompressed data', (t) => {
    const method = new RemoteMethod('test', BARE_AGENT, { host: 'localhost' })
    method._safeRequest = (options) => {
      t.equal(options.body, '"data"')

      t.end()
    }

    method.invoke('data', {})
  })
})

tap.test('when the connection fails', (t) => {
  t.autoend()

  t.test('should return the connection failure', (t) => {
    const config = {
      max_payload_size_in_bytes: 100000
    }

    const endpoint = {
      host: 'localhost',
      port: 8765
    }

    const method = new RemoteMethod('TEST', { ...BARE_AGENT, config }, endpoint)
    method.invoke({ message: 'none' }, {}, (error) => {
      t.ok(error)
      // regex for either ipv4 or ipv6 localhost
      t.equal(error.code, 'ECONNREFUSED')

      t.end()
    })
  })

  t.test('should correctly handle a DNS lookup failure', (t) => {
    const config = {
      max_payload_size_in_bytes: 100000
    }
    const endpoint = {
      host: 'failed.domain.cxlrg',
      port: 80
    }
    const method = new RemoteMethod('TEST', { ...BARE_AGENT, config }, endpoint)
    method.invoke([], {}, (error) => {
      t.ok(error)

      // https://github.com/joyent/node/commit/7295bb9435c
      t.match(
        error.message,
        /^getaddrinfo E(NOENT|NOTFOUND)( failed.domain.cxlrg)?( failed.domain.cxlrg:80)?$/ // eslint-disable-line max-len
      )

      t.end()
    })
  })
})

tap.test('when posting to collector', (t) => {
  t.autoend()

  const RUN_ID = 1337
  const URL = 'https://collector.newrelic.com'
  let nock = null
  let config = null
  let method = null

  t.beforeEach(() => {
    // TODO: is this true?
    // order dependency: requiring nock at the top of the file breaks other tests
    nock = require('nock')
    nock.disableNetConnect()

    config = new Config({
      ssl: true,
      run_id: RUN_ID,
      license_key: 'license key here'
    })

    const endpoint = {
      host: 'collector.newrelic.com',
      port: 443
    }

    method = new RemoteMethod('metric_data', { ...BARE_AGENT, config }, endpoint)
  })

  t.afterEach(() => {
    config = null
    method = null
    nock.cleanAll()
    nock.enableNetConnect()
  })

  t.test('should pass through error when compression fails', (t) => {
    method = new RemoteMethod('test', BARE_AGENT, { host: 'localhost' })
    method._shouldCompress = () => true
    // zlib.deflate really wants a stringlike entity
    method._post(-1, {}, (error) => {
      t.ok(error)

      t.end()
    })
  })

  t.test('successfully', (t) => {
    t.autoend()

    function nockMetricDataUncompressed() {
      return nock(URL)
        .post(generate('metric_data', RUN_ID))
        .matchHeader('Content-Encoding', 'identity')
        .reply(200, { return_value: [] })
    }

    t.test('should invoke the callback without error', (t) => {
      nockMetricDataUncompressed()
      method._post('[]', {}, (error) => {
        t.error(error)
        t.end()
      })
    })

    t.end('should use the right URL', (t) => {
      const sendMetrics = nockMetricDataUncompressed()
      method._post('[]', {}, (error) => {
        t.error(error)
        t.ok(sendMetrics.isDone())
        t.end()
      })
    })

    t.end('should respect the put_for_data_send config', (t) => {
      const putMetrics = nock(URL)
        .put(generate('metric_data', RUN_ID))
        .reply(200, { return_value: [] })

      config.put_for_data_send = true
      method._post('[]', {}, (error) => {
        t.error(error)
        t.ok(putMetrics.isDone())

        t.end()
      })
    })

    t.test('should default to gzip compression', (t) => {
      const sendGzippedMetrics = nock(URL)
        .post(generate('metric_data', RUN_ID))
        .matchHeader('Content-Encoding', 'gzip')
        .reply(200, { return_value: [] })

      method._shouldCompress = () => true
      method._post('[]', {}, (error) => {
        t.error(error)

        t.ok(sendGzippedMetrics.isDone())

        t.end()
      })
    })

    t.test('should use deflate compression when requested', (t) => {
      method._agent.config.compressed_content_encoding = 'deflate'
      const sendDeflatedMetrics = nock(URL)
        .post(generate('metric_data', RUN_ID))
        .matchHeader('Content-Encoding', 'deflate')
        .reply(200, { return_value: [] })

      method._shouldCompress = () => true
      method._post('[]', {}, (error) => {
        t.error(error)

        t.ok(sendDeflatedMetrics.isDone())

        t.end()
      })
    })

    t.test('should respect the compressed_content_encoding config', (t) => {
      const sendGzippedMetrics = nock(URL)
        .post(generate('metric_data', RUN_ID))
        .matchHeader('Content-Encoding', 'gzip')
        .reply(200, { return_value: [] })

      config.compressed_content_encoding = 'gzip'
      method._shouldCompress = () => true
      method._post('[]', {}, (error) => {
        t.error(error)

        t.ok(sendGzippedMetrics.isDone())
        t.end()
      })
    })
  })

  t.test('unsuccessfully', (t) => {
    t.autoend()

    function nockMetric500() {
      return nock(URL).post(generate('metric_data', RUN_ID)).reply(500, { return_value: [] })
    }

    t.test('should invoke the callback without error', (t) => {
      nockMetric500()
      method._post('[]', {}, (error) => {
        t.error(error)
        t.end()
      })
    })

    t.test('should include status code in response', (t) => {
      const sendMetrics = nockMetric500()
      method._post('[]', {}, (error, response) => {
        t.error(error)
        t.equal(response.status, 500)
        t.ok(sendMetrics.isDone())

        t.end()
      })
    })
  })

  t.test('with an error', (t) => {
    t.autoend()

    let thrown = null
    let originalSafeRequest = null

    t.beforeEach(() => {
      thrown = new Error('whoops!')
      originalSafeRequest = method._safeRequest
      method._safeRequest = () => {
        throw thrown
      }
    })

    t.afterEach(() => {
      method._safeRequest = originalSafeRequest
    })

    t.test('should not allow the error to go uncaught', (t) => {
      method._post('[]', null, (caught) => {
        t.equal(caught, thrown)
        t.end()
      })
    })
  })

  t.test('parsing successful response', (t) => {
    t.autoend()

    const response = {
      return_value: 'collector-42.newrelic.com'
    }

    t.beforeEach(() => {
      const successConfig = new Config({
        ssl: true,
        license_key: 'license key here'
      })

      const endpoint = {
        host: 'collector.newrelic.com',
        port: 443
      }

      const agent = { config: successConfig, metrics: { measureBytes() {} } }
      method = new RemoteMethod('preconnect', agent, endpoint)

      nock(URL).post(generate('preconnect')).reply(200, response)
    })

    t.test('should not error', (t) => {
      method.invoke(null, {}, (error) => {
        t.error(error)

        t.end()
      })
    })

    t.test('should find the expected value', (t) => {
      method.invoke(null, {}, (error, res) => {
        t.equal(res.payload, 'collector-42.newrelic.com')

        t.end()
      })
    })
  })

  t.test('parsing error response', (t) => {
    t.autoend()

    const response = {}

    t.beforeEach(() => {
      nock(URL).post(generate('metric_data', RUN_ID)).reply(409, response)
    })

    t.test('should include status in callback response', (t) => {
      method.invoke([], {}, (error, res) => {
        t.error(error)
        t.equal(res.status, 409)

        t.end()
      })
    })
  })
})

tap.test('when generating headers for a plain request', (t) => {
  t.autoend()

  let headers = null
  let options = null
  let method = null

  t.beforeEach(() => {
    const config = new Config({
      run_id: 12
    })

    const endpoint = {
      host: 'collector.newrelic.com',
      port: '80'
    }

    const body = 'test☃'
    method = new RemoteMethod(body, { config }, endpoint)

    options = {
      body,
      compressed: false
    }

    headers = method._headers(options)
  })

  t.test('should use the content type from the parameter', (t) => {
    t.equal(headers['CONTENT-ENCODING'], 'identity')
    t.end()
  })

  t.test('should generate the content length from the body parameter', (t) => {
    t.equal(headers['Content-Length'], 7)
    t.end()
  })

  t.test('should use a keepalive connection', (t) => {
    t.equal(headers.Connection, 'Keep-Alive')
    t.end()
  })

  t.test('should have the host from the configuration', (t) => {
    t.equal(headers.Host, 'collector.newrelic.com')
    t.end()
  })

  t.test('should tell the server we are sending JSON', (t) => {
    t.equal(headers['Content-Type'], 'application/json')
    t.end()
  })

  t.test('should have a user-agent string', (t) => {
    t.ok(headers['User-Agent'])
    t.end()
  })

  t.test('should include stored NR headers in outgoing request headers', (t) => {
    options.nrHeaders = {
      'X-NR-Run-Token': 'AFBE4546FEADDEAD1243',
      'X-NR-Metadata': '12BAED78FC89BAFE1243'
    }
    headers = method._headers(options)

    t.equal(headers['X-NR-Run-Token'], 'AFBE4546FEADDEAD1243')
    t.equal(headers['X-NR-Metadata'], '12BAED78FC89BAFE1243')

    t.end()
  })
})

tap.test('when generating headers for a compressed request', (t) => {
  t.autoend()

  let headers = null

  t.beforeEach(() => {
    const config = new Config({
      run_id: 12
    })

    const endpoint = {
      host: 'collector.newrelic.com',
      port: '80'
    }

    const body = 'test☃'
    const method = new RemoteMethod(body, { config }, endpoint)

    const options = {
      body,
      compressed: true
    }

    headers = method._headers(options)
  })

  t.test('should use the content type from the parameter', (t) => {
    t.equal(headers['CONTENT-ENCODING'], 'gzip')
    t.end()
  })

  t.test('should generate the content length from the body parameter', (t) => {
    t.equal(headers['Content-Length'], 7)
    t.end()
  })

  t.test('should use a keepalive connection', (t) => {
    t.equal(headers.Connection, 'Keep-Alive')
    t.end()
  })

  t.test('should have the host from the configuration', (t) => {
    t.equal(headers.Host, 'collector.newrelic.com')
    t.end()
  })

  t.test('should tell the server we are sending JSON', (t) => {
    t.equal(headers['Content-Type'], 'application/json')
    t.end()
  })

  t.test('should have a user-agent string', (t) => {
    t.ok(headers['User-Agent'])
    t.end()
  })
})

tap.test('when generating a request URL', (t) => {
  t.autoend()

  const TEST_RUN_ID = Math.floor(Math.random() * 3000) + 1
  const TEST_METHOD = 'TEST_METHOD'
  const TEST_LICENSE = 'hamburtson'
  let config = null
  let endpoint = null
  let parsed = null

  function reconstitute(generated) {
    return url.parse(generated, true, false)
  }

  t.beforeEach(() => {
    config = new Config({
      license_key: TEST_LICENSE
    })

    endpoint = {
      host: 'collector.newrelic.com',
      port: 80
    }

    const method = new RemoteMethod(TEST_METHOD, { config }, endpoint)
    parsed = reconstitute(method._path())
  })

  t.test('should say that it supports protocol 17', (t) => {
    t.equal(parsed.query.protocol_version, '17')
    t.end()
  })

  t.test('should tell the collector it is sending JSON', (t) => {
    t.equal(parsed.query.marshal_format, 'json')
    t.end()
  })

  t.test('should pass through the license key', (t) => {
    t.equal(parsed.query.license_key, TEST_LICENSE)
    t.end()
  })

  t.test('should include the method', (t) => {
    t.equal(parsed.query.method, TEST_METHOD)
    t.end()
  })

  t.test('should not include the agent run ID when not set', (t) => {
    const method = new RemoteMethod(TEST_METHOD, { config }, endpoint)
    parsed = reconstitute(method._path())
    t.notOk(parsed.query.run_id)

    t.end()
  })

  t.test('should include the agent run ID when set', (t) => {
    config.run_id = TEST_RUN_ID
    const method = new RemoteMethod(TEST_METHOD, { config }, endpoint)
    parsed = reconstitute(method._path())
    t.equal(parsed.query.run_id, '' + TEST_RUN_ID)

    t.end()
  })

  t.test('should start with the (old-style) path', (t) => {
    t.equal(parsed.pathname.indexOf('/agent_listener/invoke_raw_method'), 0)
    t.end()
  })
})

tap.test('when generating the User-Agent string', (t) => {
  t.autoend()

  const TEST_VERSION = '0-test'
  let userAgent = null
  let version = null
  let pkg = null

  t.beforeEach(() => {
    pkg = require('../../../package.json')
    version = pkg.version
    pkg.version = TEST_VERSION
    const config = new Config({})
    const method = new RemoteMethod('test', { config }, {})

    userAgent = method._userAgent()
  })

  t.afterEach(() => {
    pkg.version = version
  })

  t.test('should clearly indicate it is New Relic for Node', (t) => {
    t.match(userAgent, 'NewRelic-NodeAgent')
    t.end()
  })

  t.test('should include the agent version', (t) => {
    t.match(userAgent, TEST_VERSION)
    t.end()
  })

  t.test('should include node version', (t) => {
    t.match(userAgent, process.versions.node)
    t.end()
  })

  t.test('should include node platform and architecture', (t) => {
    t.match(userAgent, process.platform + '-' + process.arch)
    t.end()
  })
})

tap.test('record data usage supportability metrics', (t) => {
  t.autoend()

  let endpoint

  let agent

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()
    endpoint = {
      host: agent.config.host,
      port: agent.config.port
    }
  })

  t.afterEach(() => {
    agent && helper.unloadAgent(agent)
  })

  t.test('should aggregate bytes of uploaded payloads', async (t) => {
    const method1 = new RemoteMethod('preconnect', agent, endpoint)
    const method2 = new RemoteMethod('connect', agent, endpoint)
    const payload = [{ hello: 'world' }]
    const expectedSize = 19
    const totalMetric = [2, expectedSize * 2, 0, expectedSize, expectedSize, 722]
    const singleMetric = [1, expectedSize, 0, expectedSize, expectedSize, 361]
    for (const method of [method1, method2]) {
      await new Promise((resolve, reject) => {
        method.invoke(payload, (err) => {
          err ? reject(err) : resolve()
        })
      })
    }

    tapAssertMetrics(
      t,
      {
        metrics: agent.metrics
      },
      [
        [
          {
            name: NAMES.DATA_USAGE.COLLECTOR
          },
          totalMetric
        ],
        [
          {
            name: `${NAMES.DATA_USAGE.PREFIX}/preconnect/${NAMES.DATA_USAGE.SUFFIX}`
          },
          singleMetric
        ],
        [
          {
            name: `${NAMES.DATA_USAGE.PREFIX}/connect/${NAMES.DATA_USAGE.SUFFIX}`
          },
          singleMetric
        ]
      ]
    )

    t.end()
  })

  t.test('should report response size ok', async (t) => {
    const byteLength = (data) => Buffer.byteLength(JSON.stringify(data), 'utf8')
    const payload = [{ hello: 'world' }]
    const response = { hello: 'galaxy' }
    const payloadSize = byteLength(payload)
    const responseSize = byteLength(response)
    const metric = [1, payloadSize, responseSize, 19, 19, 361]
    const method = new RemoteMethod('preconnect', agent, endpoint)
    // stub call to NR so we can test response payload metrics
    method._post = (data, nrHeaders, callback) => {
      callback(null, { payload: response })
    }
    await new Promise((resolve, reject) => {
      method.invoke(payload, (err) => {
        err ? reject(err) : resolve()
      })
    })

    tapAssertMetrics(
      t,
      {
        metrics: agent.metrics
      },
      [
        [
          {
            name: NAMES.DATA_USAGE.COLLECTOR
          },
          metric
        ],
        [
          {
            name: `${NAMES.SUPPORTABILITY.NODEJS}/Collector/preconnect/${NAMES.DATA_USAGE.SUFFIX}`
          },
          metric
        ]
      ]
    )
  })

  t.test('should record metrics even if posting a payload fails', async (t) => {
    const byteLength = (data) => Buffer.byteLength(JSON.stringify(data), 'utf8')
    const payload = [{ hello: 'world' }]
    const payloadSize = byteLength(payload)
    const metric = [1, payloadSize, 0, 19, 19, 361]
    const method = new RemoteMethod('preconnect', agent, endpoint)
    // stub call to NR so we can test response payload metrics
    method._post = (data, nrHeaders, callback) => {
      const err = new Error('')
      callback(err)
    }
    await new Promise((resolve) => {
      method.invoke(payload, resolve)
    })

    tapAssertMetrics(
      t,
      {
        metrics: agent.metrics
      },
      [
        [
          {
            name: NAMES.DATA_USAGE.COLLECTOR
          },
          metric
        ],
        [
          {
            name: `${NAMES.DATA_USAGE.PREFIX}/preconnect/${NAMES.DATA_USAGE.SUFFIX}`
          },
          metric
        ]
      ]
    )
  })
})
