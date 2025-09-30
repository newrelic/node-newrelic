/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const DESTINATIONS = require('../../../../lib/config/attribute-filter').DESTINATIONS
const NAMES = require('../../../../lib/metrics/names')
const hashes = require('../../../../lib/util/hashes')
const helper = require('../../../lib/agent_helper')
const Shim = require('../../../../lib/shim').Shim
const createHttp2ResponseServer = require('./fixtures/http2')

test.beforeEach(async (ctx) => {
  const { server, baseUrl, responses, host, port } = await createHttp2ResponseServer()
  ctx.nr = {}
  ctx.nr.initialize = require('../../../../lib/instrumentation/core/http2')
  ctx.nr.http2 = require('node:http2')
  ctx.nr.server = server
  ctx.nr.baseUrl = baseUrl
  ctx.nr.responses = responses
  ctx.nr.host = host
  ctx.nr.port = port
  ctx.nr.path = '/path'
  ctx.nr.protocol = 'http'
  ctx.nr.method = 'POST'
})

test.afterEach(async (ctx) => {
  if (ctx.nr?.server) { // not all tests use the actual server
    ctx.nr.server.destroy()
  }
})

test('built-in http2 module instrumentation', async (t) => {
  await t.test('should not cause bootstrapping to fail', async (t) => {
    t.beforeEach(async (ctx) => {
      ctx.nr.agent = helper.loadMockedAgent()
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('when passed an empty module', (t) => {
      const { agent, initialize } = t.nr
      assert.doesNotThrow(() => initialize(agent, {}, 'http2', new Shim(agent, 'http2')))
    })
  })

  await t.test('with outbound request', async (t) => {
    t.beforeEach(async (ctx) => {
      const agent = helper.loadMockedAgent()
      const http2 = require('node:http2')
      ctx.nr.agent = agent
      ctx.nr.initialize(agent, http2, 'http2', new Shim(agent, 'http2'))
      ctx.nr.http2 = http2
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    const checkName = (t, end, name) => {
      const { transaction } = t.nr
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
      end()
    }

    await t.test('should omit query parameters from path if attributes.enabled is false', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      agent.config.attributes.enabled = false
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/asdf?a=b&another=yourself&thing&grownup=true',
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.deepEqual(child.getAttributes(), {})
        end()
      }
    })

    await t.test('should omit query parameters from path if high_security is true', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      agent.config.high_security = true
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/asdf?a=b&another=yourself&thing&grownup=true',
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.deepEqual(child.getAttributes(), {
          procedure: 'GET',
          url: `http://${host}:${port}/asdf`
        })
        end()
      }
    })

    await t.test('should obfuscate url path if url_obfuscation regex pattern is set', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      agent.config.url_obfuscation = {
        enabled: true,
        regex: {
          pattern: '.*',
          replacement: '/***'
        }
      }
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/asdf/foo/bar/baz?test=123&test2=456',
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.equal(child.name, `External/${host}:${port}/***`)
        assert.deepEqual(child.getAttributes(), {
          procedure: 'GET',
          url: `http://${host}:${port}/***`
        })
        end()
      }
    })

    await t.test('should strip query parameters from path in transaction trace segment', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      const name = NAMES.EXTERNAL.PREFIX + host + ':' + port + '/asdf'
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/asdf?a=b&another=yourself&thing&grownup=true6',
            method: 'GET'
          },
          () => checkName(t, end, name)
        )
      })
    })

    await t.test('should save query parameters from path if attributes.enabled is true', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      agent.config.attributes.enabled = true
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/asdf?a=b&another=yourself&thing&grownup=true',
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.deepEqual(
          child.attributes.get(DESTINATIONS.SPAN_EVENT),
          {
            hostname: host,
            port,
            url: `http://${host}:${port}/asdf`,
            procedure: 'GET',
            'request.parameters.a': 'b',
            'request.parameters.another': 'yourself',
            'request.parameters.thing': true,
            'request.parameters.grownup': 'true'
          },
          'adds attributes to spans'
        )
        end()
      }
    })

    await t.test('should accept a simple path with no parameters', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      const path = '/newrelic'
      const name = NAMES.EXTERNAL.PREFIX + host + ':' + port + path
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path,
            method: 'GET'
          },
          () => checkName(t, end, name)
        )
      })
    })

    await t.test('should purge trailing slash', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      const path = '/newrelic/'
      const name = NAMES.EXTERNAL.PREFIX + host + ':' + port + '/newrelic'
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path,
            method: 'GET'
          },
          () => checkName(t, end, name)
        )
      })
    })

    await t.test('should not crash when headers are null', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      const path = '/nullHead'
      const name = NAMES.EXTERNAL.PREFIX + host + ':' + port + path
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        assert.doesNotThrow(() => {
          makeRequest(
            http2,
            {
              host,
              port,
              protocol,
              path,
              method: 'GET',
              testing: { headers: null }
            },
            () => checkName(t, end, name)
          )
        })
      })
    })

    await t.test('should not crash when headers are empty', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      const path = '/emptyHead'
      const name = NAMES.EXTERNAL.PREFIX + host + ':' + port + path
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        assert.doesNotThrow(() => {
          makeRequest(
            http2,
            {
              host,
              port,
              protocol,
              path,
              method: 'GET',
              testing: { headers: {} }
            },
            () => checkName(t, end, name)
          )
        })
      })
    })

    await t.test('should conform to external segment spec', (t, end) => {
      const { agent, http2, protocol, host, port, path } = t.nr
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            protocol,
            host,
            port,
            path,
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        const attributes = child.getAttributes()
        assert.equal(attributes.url, `${protocol}://${host}:${port}${path}`)
        assert.equal(attributes.procedure, 'GET')
        end()
      }
    })

    await t.test('should start and end segment', (t, end) => {
      const { agent, http2, protocol, host, port, path } = t.nr
      let segment
      helper.runInTransaction(agent, async function () {
        t.nr.transaction = agent.getTransaction()
        segment = agent.tracer.getSegment()

        assert.ok(segment.timer.hrstart instanceof Array)
        assert.equal(segment.timer.hrDuration, null)
        makeRequest(
          http2,
          {
            protocol,
            host,
            port,
            path,
            method: 'GET'
          },
          finish
        )
      })

      async function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)

        assert.ok(child.timer.hrDuration instanceof Array)
        assert.ok(child.timer.getDurationInMillis() > 0)
        transaction.end()
        end()
      }
    })

    await t.test('should not modify parent segment when parent segment opaque', (t, end) => {
      const { agent, http2, protocol, host, port } = t.nr
      const path = '/asdf?a=123&b=abcde'
      helper.runInTransaction(agent, function (transaction) {
        t.nr.transaction = transaction
        const parentSegment = agent.tracer.createSegment({
          name: 'ParentSegment',
          parent: transaction.trace.root,
          transaction
        })
        parentSegment.opaque = true
        t.nr.parentSegment = parentSegment
        agent.tracer.setSegment({ transaction, segment: parentSegment }) // make the current active segment
        makeRequest(
          http2,
          {
            protocol,
            host,
            port,
            path,
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const segment = agent.tracer.getSegment()

        assert.equal(segment, t.nr.parentSegment)
        assert.equal(segment.name, 'ParentSegment')

        const attributes = segment.getAttributes()
        assert.ok(!attributes['request.parameters.a'])
        assert.ok(!attributes['request.parameters.b'])
        end()
      }
    })
  })

  await t.test('trace headers', async (t) => {
    t.beforeEach(async (ctx) => {
      const agent = helper.loadMockedAgent()
      const http2 = require('node:http2')
      ctx.nr.agent = agent
      ctx.nr.initialize(agent, http2, 'http2', new Shim(agent, 'http2'))
      ctx.nr.http2 = http2
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should add DT headers when `distributed_tracing` is enabled', (t, end) => {
      const { agent, http2, protocol, host, port, path } = t.nr
      agent.config.trusted_account_key = 190
      agent.config.account_id = 190
      agent.config.primary_application_id = '389103'

      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path,
            method: 'GET'
          },
          finish
        )
      })

      function finish(err, headers, body) {
        const transaction = agent.getTransaction()
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)

        assert.ok(!err)
        assert.equal(child.name, `External/${host}:${port}${path}`)
        assert.ok(headers.traceparent, 'traceparent header')
        const [version, traceId, parentSpanId, sampledFlag] = headers.traceparent.split('-')
        assert.equal(version, '00')
        assert.equal(traceId, transaction.traceId)
        assert.equal(parentSpanId, child.id)
        assert.equal(sampledFlag, '01')
        end()
      }
    })

    await t.test('should add CAT headers when `cross_application_tracer` is enabled', (t, end) => {
      const { agent, http2, protocol, host, port, path } = t.nr
      const encKey = 'testEncodingKey'
      agent.config.distributed_tracing.enabled = false
      agent.config.cross_application_tracer.enabled = true
      agent.config.encoding_key = encKey
      agent.config.trusted_account_ids = [123]
      const appData = ['123#456', 'abc', 0, 0, -1, 'xyz']
      const obfData = hashes.obfuscateNameUsingKey(JSON.stringify(appData), encKey)
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path,
            method: 'GET',
            headers: { 'x-newrelic-app-data': obfData }
          },
          finish
        )
      })

      function finish(err, headers, body) {
        assert.ok(!err)
        assert.ok(headers['x-newrelic-transaction'], 'New Relic header')
        assert.match(headers['x-newrelic-transaction'], /^[\w/-]{60,80}={0,2}$/)
        assert.ok(headers['x-newrelic-app-data'], 'New Relic app data header')
        end()
      }
    })

    await t.test('should add synthetics header when it exists on transaction', (t, end) => {
      const { agent, http2, protocol, host, port, path } = t.nr
      agent.config.encoding_key = 'testEncodingKey'

      helper.runInTransaction(agent, function () {
        const tx = agent.getTransaction()
        tx.syntheticsHeader = 'synthHeader'
        tx.syntheticsInfoHeader = 'synthInfoHeader'
        t.nr.transaction = tx
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path,
            method: 'GET'
          },
          finish
        )
      })

      function finish(err, headers, body) {
        assert.ok(!err)
        assert.ok(headers['x-newrelic-synthetics'], 'synthetics header')
        assert.equal(headers['x-newrelic-synthetics'], 'synthHeader')
        assert.ok(headers['x-newrelic-synthetics-info'], 'synthetics info header')
        assert.equal(headers['x-newrelic-synthetics-info'], 'synthInfoHeader')
        end()
      }
    })
  })
})

// Unlike http, http2 requests take place after an explicit connect is invoked
async function makeRequest(http2, params, cb) {
  const { protocol, host, port, path, method, headers: requestHeaders, body = '', testing = {} } = params
  let connectUrl
  // URL options for testing incorrectly-formed URLs
  if (!protocol) {
    connectUrl = port ? `${host}:${port}` : `${host}`
  } else {
    connectUrl = port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`
  }
  const authority = port ? `${host}:${port}` : host
  const session = await http2.connect(connectUrl)
  const http2Headers = {
    ':authority': authority,
    ':path': path,
    ':method': method
  }
  let combinedHeaders = { ...requestHeaders, ...http2Headers }
  if (testing?.headers) {
    combinedHeaders = { ...testing.headers, ...http2Headers }
  }

  const req = await session.request(combinedHeaders)

  req.on('error', function (err) {
    // If we aborted the request and the error is expected, then great.
    // http would send a connection reset, but http2 has different messaging.
    if (params.abort && err.code === 'ECONNRESET') {
      cb()
    } else {
      cb(err)
    }
  })

  req.setEncoding('utf8')
  let data = ''

  req.on('response', (headers) => {
    const responseHeaders = headers
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      session.close()
      cb(null, responseHeaders, data)
    })
  })

  if (params.abort) {
    setTimeout(function () {
      req.close()
    }, params.abort)
  }
  if (body) {
    return req.end(body)
  }
  req.end()
}
