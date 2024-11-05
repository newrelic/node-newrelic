/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const https = require('node:https')
const events = require('node:events')
const dns = require('node:dns')
const url = require('node:url')
const proxyquire = require('proxyquire')
const helper = require('../../lib/agent_helper')
const Config = require('../../../lib/config')
const Collector = require('../../lib/test-collector')
const { assertMetricValues } = require('../../lib/custom-assertions')
const RemoteMethod = require('../../../lib/collector/remote-method')

const NAMES = require('../../../lib/metrics/names')
const RUN_ID = 1337
const BARE_AGENT = { config: {}, metrics: { measureBytes() {} } }

test('should require a name for the method to call', () => {
  assert.throws(() => new RemoteMethod())
})

test('should require an agent for the method to call', () => {
  assert.throws(() => new RemoteMethod('test'))
})

test('should expose a call method as its public API', () => {
  const method = new RemoteMethod('test', BARE_AGENT)
  assert.equal(typeof method.invoke, 'function')
})

test('should expose its name', () => {
  const method = new RemoteMethod('test', BARE_AGENT)
  assert.equal(method.name, 'test')
})

test('should default to protocol 17', () => {
  const method = new RemoteMethod('test', BARE_AGENT)
  assert.equal(method._protocolVersion, 17)
})

test('serialize', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.method = new RemoteMethod('test', BARE_AGENT)
  })

  await t.test('should JSON-encode the given payload', (t, end) => {
    const { method } = t.nr
    method.serialize({ foo: 'bar' }, (error, encoded) => {
      assert.equal(error, undefined)
      assert.equal(encoded, '{"foo":"bar"}')
      end()
    })
  })

  await t.test('should not error with circular payloads', (t, end) => {
    const { method } = t.nr
    const obj = { foo: 'bar' }
    obj.obj = obj
    method.serialize(obj, (error, encoded) => {
      assert.equal(error, undefined)
      assert.equal(encoded, '{"foo":"bar","obj":"[Circular ~]"}')
      end()
    })
  })

  await t.test('should be able to handle a bigint', (t, end) => {
    const { method } = t.nr
    const obj = { big: 1729n }
    method.serialize(obj, (error, encoded) => {
      assert.equal(error, undefined)
      assert.equal(encoded, '{"big":"1729"}')
      end()
    })
  })

  await t.test('should catch serialization errors', (t, end) => {
    const { method } = t.nr
    const obj = {
      toJSON() {
        throw Error('fake serialization error')
      }
    }
    method.serialize(obj, (error, encoded) => {
      assert.equal(error.message, 'fake serialization error')
      assert.equal(encoded, undefined)
      end()
    })
  })
})

test('_safeRequest', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}

    ctx.nr.agent = helper.instrumentMockedAgent()
    ctx.nr.agent.config = { max_payload_size_in_bytes: 100 }

    ctx.nr.method = new RemoteMethod('test', ctx.nr.agent)

    ctx.nr.options = {
      host: 'collector.newrelic.com',
      port: 80,
      onError() {},
      onResponse() {},
      body: [],
      path: '/nonexistent'
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('requires an options hash', (t) => {
    const { method } = t.nr
    assert.throws(() => method._safeRequest(), /Must include options to make request!/)
  })

  await t.test('requires a collector hostname', (t) => {
    const { method, options } = t.nr
    delete options.host
    assert.throws(() => method._safeRequest(options), /Must include collector hostname!/)
  })

  await t.test('requires a collector port', (t) => {
    const { method, options } = t.nr
    delete options.port
    assert.throws(() => method._safeRequest(options), /Must include collector port!/)
  })

  await t.test('requires an error callback', (t) => {
    const { method, options } = t.nr
    delete options.onError
    assert.throws(() => method._safeRequest(options), /Must include error handler!/)
  })

  await t.test('requires a response callback', (t) => {
    const { method, options } = t.nr
    delete options.onResponse
    assert.throws(() => method._safeRequest(options), /Must include response handler!/)
  })

  await t.test('requires a request body', (t) => {
    const { method, options } = t.nr
    delete options.body
    assert.throws(() => method._safeRequest(options), /Must include body to send to collector!/)
  })

  await t.test('requires a request URL', (t) => {
    const { method, options } = t.nr
    delete options.path
    assert.throws(() => method._safeRequest(options), /Must include URL to request!/)
  })

  await t.test('requires a request body within the maximum payload size limit', (t) => {
    const { agent, method, options } = t.nr
    options.body = 'a'.repeat(method._config.max_payload_size_in_bytes + 1)

    try {
      method._safeRequest(options)
    } catch (error) {
      assert.equal(error.message, 'Maximum payload size exceeded')
      assert.equal(error.code, 'NR_REMOTE_METHOD_MAX_PAYLOAD_SIZE_EXCEEDED')
    }

    const { unscoped: metrics } = helper.getMetrics(agent)
    assert.equal(
      metrics['Supportability/Nodejs/Collector/MaxPayloadSizeLimit/test'].callCount,
      1,
      'should log MaxPayloadSizeLimit supportibility metric'
    )
  })
})

test('when calling a method on the collector', async (t) => {
  await t.test('should not throw when dealing with compressed data', (t, end) => {
    const method = new RemoteMethod('test', BARE_AGENT, { host: 'localhost' })
    method._shouldCompress = () => true
    method._safeRequest = (options) => {
      assert.equal(options.body.readUInt8(0), 31)
      assert.equal(options.body.length, 26)
      end()
    }
    method.invoke('data', {})
  })

  await t.test('should not throw when preparing uncompressed data', (t, end) => {
    const method = new RemoteMethod('test', BARE_AGENT, { host: 'localhost' })
    method._safeRequest = (options) => {
      assert.equal(options.body, '"data"')
      end()
    }
    method.invoke('data', {})
  })
})

test('when the connection fails', async (t) => {
  await t.test('should return the connection failure', (t, end) => {
    const req = https.request
    https.request = () => {
      const error = Error('no server')
      error.code = 'ECONNREFUSED'
      const r = new events.EventEmitter()
      r.end = function () {
        this.emit('error', error)
      }
      return r
    }
    t.after(() => {
      https.request = req
    })

    const config = { max_payload_size_in_bytes: 100_000 }
    const endpoint = { host: 'localhost', port: 8765 }
    const method = new RemoteMethod('TEST', { ...BARE_AGENT, config }, endpoint)
    method.invoke({ message: 'none' }, {}, (error) => {
      assert.equal(error.code, 'ECONNREFUSED')
      end()
    })
  })

  await t.test('should correctly handle a DNS lookup failure', (t, end) => {
    const lookup = dns.lookup
    dns.lookup = (a, b, cb) => {
      const error = Error('no dns')
      error.code = dns.NOTFOUND
      return cb(error)
    }
    t.after(() => {
      dns.lookup = lookup
    })

    const config = { max_payload_size_in_bytes: 100_000 }
    const endpoint = { host: 'failed.domain.cxlrg', port: 80 }
    const method = new RemoteMethod('TEST', { ...BARE_AGENT, config }, endpoint)
    method.invoke([], {}, (error) => {
      assert.equal(error.message, 'no dns')
      end()
    })
  })
})

test('when posting to collector', async (t) => {
  t.beforeEach(async (ctx) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    ctx.nr.config = new Config({
      ssl: true,
      run_id: RUN_ID,
      license_key: 'license key here'
    })
    ctx.nr.endpoint = { host: collector.host, port: collector.port }

    ctx.nr.method = new RemoteMethod(
      'metric_data',
      { ...BARE_AGENT, config: ctx.nr.config },
      ctx.nr.endpoint
    )
  })

  t.afterEach((ctx) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'
    ctx.nr.collector.close()
  })

  await t.test('should pass through error when compression fails', (t, end) => {
    const { method } = t.nr
    method._shouldCompress = () => true
    method._post(-1, {}, (error) => {
      assert.equal(
        error.message.startsWith(
          'The "chunk" argument must be of type string or an instance of Buffer'
        ),
        true
      )
      end()
    })
  })

  await t.test('successfully', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr.requestMethod = ''
      ctx.nr.headers = {}
      ctx.nr.collector.addHandler(
        helper.generateCollectorPath('metric_data', RUN_ID),
        (req, res) => {
          const encoding = req.headers['content-encoding']
          assert.equal(['identity', 'deflate', 'gzip'].includes(encoding), true)
          ctx.nr.requestMethod = req.method
          ctx.nr.headers = req.headers
          res.json({ payload: { return_value: [] } })
        }
      )
    })

    await t.test('should invoke the callback without error', (t, end) => {
      const { collector, method } = t.nr
      method._post('[]', {}, (error) => {
        assert.equal(error, undefined)
        assert.equal(collector.isDone('metric_data'), true)
        end()
      })
    })

    await t.test('should use the right URL', (t, end) => {
      const { collector, method } = t.nr
      method._post('[]', {}, (error) => {
        assert.equal(error, undefined)
        assert.equal(collector.isDone('metric_data'), true)
        end()
      })
    })

    await t.test('should respect the put_for_data_send config', (t, end) => {
      const { collector, method } = t.nr
      t.nr.config.put_for_data_send = true
      method._post('[]', {}, (error) => {
        assert.equal(error, undefined)
        assert.equal(collector.isDone('metric_data'), true)
        assert.equal(t.nr.requestMethod, 'PUT')
        end()
      })
    })

    await t.test('should default to gzip compression', (t, end) => {
      const { collector, method } = t.nr
      t.nr.config.put_for_data_send = true
      method._shouldCompress = () => true
      method._post('[]', {}, (error) => {
        assert.equal(error, undefined)
        assert.equal(collector.isDone('metric_data'), true)
        assert.equal(t.nr.headers['content-encoding'].includes('gzip'), true)
        end()
      })
    })

    await t.test('should use deflate compression when requested', (t, end) => {
      const { collector, method } = t.nr
      t.nr.config.put_for_data_send = true
      method._shouldCompress = () => true
      method._agent.config.compressed_content_encoding = 'deflate'
      method._post('[]', {}, (error) => {
        assert.equal(error, undefined)
        assert.equal(collector.isDone('metric_data'), true)
        assert.equal(t.nr.headers['content-encoding'].includes('deflate'), true)
        end()
      })
    })

    await t.test('should respect the compressed_content_encoding config', (t, end) => {
      const { collector, method } = t.nr
      t.nr.config.put_for_data_send = true
      // gzip is the default, so use deflate to give a value to verify.
      t.nr.config.compressed_content_encoding = 'deflate'
      method._shouldCompress = () => true
      method._post('[]', {}, (error) => {
        assert.equal(error, undefined)
        assert.equal(collector.isDone('metric_data'), true)
        assert.equal(t.nr.headers['content-encoding'].includes('deflate'), true)
        end()
      })
    })
  })
})

test('when generating headers for a plain request', async (t) => {
  t.beforeEach(async (ctx) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    ctx.nr.config = new Config({ run_id: RUN_ID })
    ctx.nr.endpoint = { host: collector.host, port: collector.port }

    const body = 'test☃'
    ctx.nr.method = new RemoteMethod(
      body,
      { ...BARE_AGENT, config: ctx.nr.config },
      ctx.nr.endpoint
    )

    ctx.nr.options = { body, compressed: false }
    ctx.nr.headers = ctx.nr.method._headers(ctx.nr.options)
  })

  t.afterEach((ctx) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'
    ctx.nr.collector.close()
  })

  await t.test('should use the content type from the parameter', (t) => {
    assert.equal(t.nr.headers['CONTENT-ENCODING'], 'identity')
  })

  await t.test('should generate the content length from the body parameter', (t) => {
    assert.equal(t.nr.headers['Content-Length'], 7)
  })

  await t.test('should use keepalive connection', (t) => {
    assert.equal(t.nr.headers.Connection, 'Keep-Alive')
  })

  await t.test('should have the host from the configuration', (t) => {
    assert.equal(t.nr.headers.Host, t.nr.collector.host)
  })

  await t.test('should tell the server we are sending JSON', (t) => {
    assert.equal(t.nr.headers['Content-Type'], 'application/json')
  })

  await t.test('should have a user-agent string', (t) => {
    assert.equal(t.nr.headers['User-Agent'].startsWith('NewRelic-NodeAgent'), true)
  })

  await t.test('should include stored NR headers in outgoing request headers', (t) => {
    const { method, options } = t.nr
    options.nrHeaders = {
      'X-NR-Run-Token': 'AFBE4546FEADDEAD1243',
      'X-NR-Metadata': '12BAED78FC89BAFE1243'
    }
    const headers = method._headers(options)
    assert.equal(headers['X-NR-Run-Token'], 'AFBE4546FEADDEAD1243')
    assert.equal(headers['X-NR-Metadata'], '12BAED78FC89BAFE1243')
  })
})

test('when generating headers for a compressed request', async (t) => {
  t.beforeEach(async (ctx) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    ctx.nr.config = new Config({ run_id: RUN_ID })
    ctx.nr.endpoint = { host: collector.host, port: collector.port }

    const body = 'test☃'
    ctx.nr.method = new RemoteMethod(
      body,
      { ...BARE_AGENT, config: ctx.nr.config },
      ctx.nr.endpoint
    )

    ctx.nr.options = { body, compressed: true }
    ctx.nr.headers = ctx.nr.method._headers(ctx.nr.options)
  })

  t.afterEach((ctx) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'
    ctx.nr.collector.close()
  })

  await t.test('should use the content type from the parameter', (t) => {
    assert.equal(t.nr.headers['CONTENT-ENCODING'], 'gzip')
  })

  await t.test('should generate the content length from the body parameter', (t) => {
    assert.equal(t.nr.headers['Content-Length'], 7)
  })

  await t.test('should use keepalive connection', (t) => {
    assert.equal(t.nr.headers.Connection, 'Keep-Alive')
  })

  await t.test('should have the host from the configuration', (t) => {
    assert.equal(t.nr.headers.Host, t.nr.collector.host)
  })

  await t.test('should tell the server we are sending JSON', (t) => {
    assert.equal(t.nr.headers['Content-Type'], 'application/json')
  })

  await t.test('should have a user-agent string', (t) => {
    assert.equal(t.nr.headers['User-Agent'].startsWith('NewRelic-NodeAgent'), true)
  })
})

test('when generating headers request URL', async (t) => {
  const TEST_RUN_ID = Math.floor(Math.random() * 3000) + 1
  const TEST_METHOD = 'TEST_METHOD'
  const TEST_LICENSE = 'hamburtson'

  t.beforeEach(async (ctx) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    ctx.nr.config = new Config({ license_key: TEST_LICENSE })
    ctx.nr.endpoint = { host: collector.host, port: collector.port }

    ctx.nr.method = new RemoteMethod(
      TEST_METHOD,
      { ...BARE_AGENT, config: ctx.nr.config },
      ctx.nr.endpoint
    )

    ctx.nr.parsed = url.parse(ctx.nr.method._path(), true, false)
  })

  t.afterEach((ctx) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'
    ctx.nr.collector.close()
  })

  await t.test('should say that it supports protocol 17', (t) => {
    assert.equal(t.nr.parsed.query.protocol_version, 17)
  })

  await t.test('should tell the collector it is sending JSON', (t) => {
    assert.equal(t.nr.parsed.query.marshal_format, 'json')
  })

  await t.test('should pass through the license key', (t) => {
    assert.equal(t.nr.parsed.query.license_key, TEST_LICENSE)
  })

  await t.test('should include the method', (t) => {
    assert.equal(t.nr.parsed.query.method, TEST_METHOD)
  })

  await t.test('should not include the agent run ID when not set', (t) => {
    const method = new RemoteMethod(TEST_METHOD, { config: t.nr.config }, t.nr.endpoint)
    const parsed = url.parse(method._path(), true, false)
    assert.equal(parsed.query.run_id, undefined)
  })

  await t.test('should include the agent run ID when set', (t) => {
    t.nr.config.run_id = TEST_RUN_ID
    const method = new RemoteMethod(TEST_METHOD, { config: t.nr.config }, t.nr.endpoint)
    const parsed = url.parse(method._path(), true, false)
    assert.equal(parsed.query.run_id, TEST_RUN_ID)
  })

  await t.test('should start with the (old-style) path', (t) => {
    assert.equal(t.nr.parsed.pathname.indexOf('/agent_listener/invoke_raw_method'), 0)
  })
})

test('when generating the User-Agent string', async (t) => {
  const TEST_VERSION = '0-test'
  const pkg = require('../../../package.json')

  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    ctx.nr.version = pkg.version
    pkg.version = TEST_VERSION

    ctx.nr.config = new Config({})
    ctx.nr.method = new RemoteMethod('test', { config: ctx.nr.config }, {})
    ctx.nr.userAgent = ctx.nr.method._userAgent()
  })

  t.afterEach((ctx) => {
    pkg.version = ctx.nr.version
  })

  await t.test('should clearly indicate it is New Relic for Node', (t) => {
    assert.equal(t.nr.userAgent.startsWith('NewRelic-NodeAgent'), true)
  })

  await t.test('should include the agent version', (t) => {
    assert.equal(t.nr.userAgent.includes(TEST_VERSION), true)
  })

  await t.test('should include node version', (t) => {
    assert.equal(t.nr.userAgent.includes(process.versions.node), true)
  })

  await t.test('should include node platform and architecture', (t) => {
    assert.equal(t.nr.userAgent.includes(process.platform + '-' + process.arch), true)
  })
})

test('record data usage supportability metrics', async (t) => {
  t.beforeEach(async (ctx) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    ctx.nr.config = new Config({ license_key: 'license key here' })
    ctx.nr.endpoint = { host: collector.host, port: collector.port }

    ctx.nr.agent = helper.instrumentMockedAgent(collector.agentConfig)
  })

  t.afterEach((ctx) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  await t.test('should aggregate bytes of uploaded payloads', async (t) => {
    const { agent, endpoint } = t.nr

    const method1 = new RemoteMethod('preconnect', agent, endpoint)
    const method2 = new RemoteMethod('connect', agent, endpoint)
    const payload = [{ hello: 'world' }]
    const expectedSize = 19
    const totalMetric = [2, expectedSize * 2, 79, expectedSize, expectedSize, 722]
    const preconnectMetric = [1, expectedSize, 58, expectedSize, expectedSize, 361]
    const connectMetric = [1, expectedSize, 21, expectedSize, expectedSize, 361]

    for (const method of [method1, method2]) {
      await new Promise((resolve, reject) => {
        method.invoke(payload, (error) => {
          error ? reject(error) : resolve()
        })
      })
    }

    assertMetricValues({ metrics: agent.metrics }, [
      [{ name: NAMES.DATA_USAGE.COLLECTOR }, totalMetric],
      [
        { name: `${NAMES.DATA_USAGE.PREFIX}/preconnect/${NAMES.DATA_USAGE.SUFFIX}` },
        preconnectMetric
      ],
      [{ name: `${NAMES.DATA_USAGE.PREFIX}/connect/${NAMES.DATA_USAGE.SUFFIX}` }, connectMetric]
    ])
  })

  await t.test('should report response size ok', async (t) => {
    const { agent, endpoint } = t.nr

    const byteLength = (data) => Buffer.byteLength(JSON.stringify(data), 'utf8')
    const payload = [{ hello: 'world' }]
    const response = { hello: 'galaxy' }
    const payloadSize = byteLength(payload)
    const responseSize = byteLength(response)
    const metric = [1, payloadSize, responseSize, 19, 19, 361]
    const method = new RemoteMethod('preconnect', agent, endpoint)

    // Stub call to NR so we can test response payload metrics:
    method._post = (data, nrHeaders, callback) => {
      callback(null, { payload: response })
    }

    await new Promise((resolve, reject) => {
      method.invoke(payload, (error) => {
        error ? reject(error) : resolve()
      })
    })

    assertMetricValues({ metrics: agent.metrics }, [
      [{ name: NAMES.DATA_USAGE.COLLECTOR }, metric],
      [{ name: `${NAMES.DATA_USAGE.PREFIX}/preconnect/${NAMES.DATA_USAGE.SUFFIX}` }, metric]
    ])
  })

  await t.test('should record metrics even if posting a payload fails', async (t) => {
    const { agent, endpoint } = t.nr

    const byteLength = (data) => Buffer.byteLength(JSON.stringify(data), 'utf8')
    const payload = [{ hello: 'world' }]
    const payloadSize = byteLength(payload)
    const metric = [1, payloadSize, 0, 19, 19, 361]
    const method = new RemoteMethod('preconnect', agent, endpoint)

    // Stub call to NR so we can test response payload metrics:
    method._post = (data, nrHeaders, callback) => {
      callback(Error(''))
    }

    await new Promise((resolve) => {
      method.invoke(payload, resolve)
    })

    assertMetricValues({ metrics: agent.metrics }, [
      [{ name: NAMES.DATA_USAGE.COLLECTOR }, metric],
      [{ name: `${NAMES.DATA_USAGE.PREFIX}/preconnect/${NAMES.DATA_USAGE.SUFFIX}` }, metric]
    ])
  })
})

test('_safeRequest logging', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}

    ctx.nr.logs = {
      info: [],
      trace: []
    }
    ctx.nr.logger = {
      child() {
        return this
      },
      info(...args) {
        ctx.nr.logs.info.push(args)
      },
      trace(...args) {
        ctx.nr.logs.trace.push(args)
      },
      traceEnabled() {
        return true
      }
    }
    const RemoteMethod = proxyquire('../../../lib/collector/remote-method', {
      '../logger': ctx.nr.logger
    })
    RemoteMethod.prototype._request = () => {}
    ctx.nr.RemoteMethod = RemoteMethod

    ctx.nr.options = {
      host: 'something',
      port: 80,
      onError() {},
      onResponse() {},
      body: 'test-body',
      path: '/nonexistent'
    }
    ctx.nr.config = {
      license_key: 'shhh-dont-tell',
      max_payload_size_in_bytes: 10_000
    }
  })

  await t.test('should redact license key in logs', (t) => {
    const { RemoteMethod, options, config } = t.nr
    const method = new RemoteMethod('test', { config })
    method._safeRequest(options)
    assert.deepStrictEqual(
      t.nr.logs.trace,
      [
        [
          { body: options.body },
          'Posting to %s://%s:%s%s',
          'https',
          options.host,
          options.port,
          '/agent_listener/invoke_raw_method?marshal_format=json&protocol_version=17&license_key=REDACTED&method=test'
        ]
      ],
      'should redact key in trace level log'
    )
  })

  await t.test('should call logger if trace is not enabled but audit logging is enabled', (t) => {
    const { RemoteMethod, options, config, logger } = t.nr
    logger.traceEnabled = () => false
    config.logging = { level: 'info' }
    config.audit_log = { enabled: true, endpoints: ['test'] }

    const method = new RemoteMethod('test', { config })
    method._safeRequest(options)
    assert.deepStrictEqual(
      t.nr.logs.info,
      [
        [
          { body: options.body },
          'Posting to %s://%s:%s%s',
          'https',
          options.host,
          options.port,
          '/agent_listener/invoke_raw_method?marshal_format=json&protocol_version=17&license_key=REDACTED&method=test'
        ]
      ],
      'should redact key in trace level log'
    )
  })

  await t.test('should not call logger if trace or audit logging is not enabled', (t) => {
    const { RemoteMethod, options, config, logger } = t.nr
    logger.traceEnabled = () => false

    const method = new RemoteMethod('test', { config })
    method._safeRequest(options)
    assert.equal(t.nr.logs.info.length, 0)
    assert.equal(t.nr.logs.trace.length, 0)
  })
})
