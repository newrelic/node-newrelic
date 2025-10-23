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
const createHttp2ResponseServer = require('./fixtures/http2')
const events = require('node:events')
const nodeVersion = Number(/^v?(\d+)/.exec(process.version)[1])

const beforeEach = async (ctx) => {
  const { server, baseUrl, responses, host, port } = await createHttp2ResponseServer()
  const agent = await helper.instrumentMockedAgent()
  const http2 = require('node:http2')

  ctx.nr = {
    server,
    baseUrl,
    responses,
    host,
    port,
    path: '/',
    protocol: 'http',
    method: 'POST',
    agent,
    http2
  }
}

const afterEach = (ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  if (ctx.nr?.server) { // not all tests use the actual server
    ctx.nr.server.destroy()
  }
}

test('http2 outbound request', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  const checkName = (t, end, name) => {
    const { transaction } = t.nr
    const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
    assert.equal(child.name, name)
    end()
  }

  await t.test('should add unscoped metrics for an external request', (t, end) => {
    const { agent, http2, port, protocol, host } = t.nr
    helper.runInTransaction(agent, function () {
      t.nr.transaction = agent.getTransaction()
      makeRequest(
        http2,
        {
          port,
          protocol,
          host,
          path: '/a?b=c&d=e&f=g',
          method: 'GET'
        },
        finish
      )
    })

    function finish() {
      t.nr.transaction.end()
      const expectedNames = [
            `External/${host}:${port}/http2`,
            `External/${host}:${port}/all`,
            'External/allWeb',
            'External/all'
      ]
      expectedNames.forEach((metricName) => {
        const metric = agent.metrics.getOrCreateMetric(metricName)
        assert.equal(
          metric.callCount,
          1,
                `should record unscoped external metric of ${metricName} for an undici request`
        )
      })
      end()
    }
  })

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
      const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
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
      const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
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
      const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
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
        finish
      )
    })

    function finish() {
      const { transaction } = t.nr
      const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
      const attrs = child.getAttributes()
      assert.equal(attrs.url, `${protocol}://${host}:${port}/asdf`)
      assert.equal(attrs.procedure, 'GET')
      end()
    }
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
      const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
      const spanAttrs = child.attributes.get(DESTINATIONS.SPAN_EVENT)
      assert.deepEqual(
        spanAttrs,
        {
          hostname: host,
          port,
          url: `http://${host}:${port}/asdf`,
          'http.statusCode': 200,
          procedure: 'GET',
          'request.parameters.a': 'b',
          'request.parameters.another': 'yourself',
          'request.parameters.thing': true,
          'request.parameters.grownup': 'true'
        }
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

  await t.test('should not crash if path is not set', (t, end) => {
    const { agent, http2, port, protocol, host } = t.nr
    const name = NAMES.EXTERNAL.PREFIX + host + ':' + port + '/'
    helper.runInTransaction(agent, function () {
      t.nr.transaction = agent.getTransaction()
      makeRequest(
        http2,
        {
          port,
          protocol,
          host,
          method: 'GET'
        },
        () => checkName(t, end, name)
      )
    })
  })

  await t.test('should parse raw headers if headers are not an object', { skip: nodeVersion < 22 }, (t, end) => {
    // Raw headers as a stream option were introduced in Node v22, so we skip anything earlier.
    const { agent, http2, port, protocol, host } = t.nr
    const path = '/rawHeaders?first=1&second=2'
    const name = NAMES.EXTERNAL.PREFIX + host + ':' + port + '/rawHeaders'
    helper.runInTransaction(agent, function () {
      t.nr.transaction = agent.getTransaction()
      assert.doesNotThrow(() => {
        makeRequest(
          http2,
          {
            protocol,
            host,
            port,
            testing: { overrideHeaders: [':path', path] }
          },
          finish
        )
      })
    })
    async function finish() {
      const { transaction } = t.nr
      const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
      assert.deepEqual(
        child.attributes.get(DESTINATIONS.SPAN_EVENT),
        {
          hostname: host,
          port,
          url: `http://${host}:${port}/rawHeaders`,
          'http.statusCode': 200,
          procedure: 'GET',
          'request.parameters.first': '1',
          'request.parameters.second': '2'
        }
      )
      end()
    }
  })

  await t.test('should be able to use host header if authority is not set', (t, end) => {
    const { agent, http2, port, protocol, host } = t.nr
    const path = '/noAuthority?first=1&second=2'
    const name = NAMES.EXTERNAL.PREFIX + host + ':' + port + '/noAuthority'
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
            testing: { overrideHeaders: { ':path': path, host: `${host}:${port}`, ':method': 'GET' } }
          },
          finish
        )
      })
    })
    async function finish() {
      const { transaction } = t.nr
      const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
      assert.deepEqual(
        child.attributes.get(DESTINATIONS.SPAN_EVENT),
        {
          hostname: host,
          port,
          url: `http://${host}:${port}/noAuthority`,
          'http.statusCode': 200,
          procedure: 'GET',
          'request.parameters.first': '1',
          'request.parameters.second': '2'
        }
      )
      end()
    }
  })

  await t.test('should be able to use :authority pseudoheader if host/port is not set', (t, end) => {
    const { agent, http2, port, protocol, host } = t.nr
    const path = '/noHost?first=1&second=2'
    const name = NAMES.EXTERNAL.PREFIX + host + ':' + port + '/noHost'
    helper.runInTransaction(agent, function () {
      t.nr.transaction = agent.getTransaction()
      assert.doesNotThrow(() => {
        makeRequest(
          http2,
          {
            host, // for connect
            port, // for connect
            protocol,
            method: 'GET',
            testing: { overrideHeaders: { ':path': path, ':authority': `${host}:${port}` } }
          },
          finish
        )
      })
    })
    async function finish() {
      const { transaction } = t.nr
      const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
      assert.deepEqual(
        child.attributes.get(DESTINATIONS.SPAN_EVENT),
        {
          hostname: host,
          port,
          url: `http://${host}:${port}/noHost`,
          'http.statusCode': 200,
          procedure: 'GET',
          'request.parameters.first': '1',
          'request.parameters.second': '2'
        }
      )
      end()
    }
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
    const { agent, http2, protocol, host, port } = t.nr
    const path = '/path'
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
      const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
      const attributes = child.getAttributes()
      assert.equal(attributes.url, `${protocol}://${host}:${port}${path}`)
      assert.equal(attributes.procedure, 'GET')
      end()
    }
  })

  await t.test('should start and end segment', (t, end) => {
    const { agent, http2, protocol, host, port } = t.nr
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
          path: '/',
          method: 'GET'
        },
        finish
      )
    })

    async function finish() {
      const { transaction } = t.nr
      const [, child] = transaction.trace.getChildren(transaction.trace.root.id)

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

  await t.test('should not record segments and should not error if not run in a transaction', (t, end) => {
    // Raw headers as a stream option were introduced in Node v22, so we skip anything earlier.
    const { agent, http2, port, protocol, host } = t.nr
    const path = '/first?second=2&third=3'
    assert.doesNotThrow(() => {
      makeRequest(
        http2,
        {
          protocol,
          host,
          port,
          path
        },
        finish
      )
    })
    async function finish() {
      const events = agent.transactionEventAggregator.events.toArray()
      assert.equal(events.length, 0, 'should not create transaction events')
      end()
    }
  })
})

test('http trace headers', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  function formatHeaders(headers, type) {
    if (type === 'raw') {
      const rawHeaders = []
      for (const [key, value] of Object.entries(headers)) {
        rawHeaders.push(key, value)
      }
      return rawHeaders
    }
    return headers
  }

  const headersForTest = ['object']
  if (nodeVersion >= 22) {
    headersForTest.push('raw')
  }
  for await (const requestHeaders of headersForTest) {
    await t.test(`header type (${requestHeaders}): should add DT headers when 'distributed_tracing' is enabled`, (t, end) => {
      const { agent, http2, protocol, host, port, path } = t.nr
      agent.config.trusted_account_key = 190
      agent.config.account_id = 190
      agent.config.primary_application_id = '389103'
      const testHeaders = formatHeaders({ host: `${host}:${port}`, ':path': path, ':method': 'GET' }, requestHeaders)

      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        // add host header correctly for this test's header type
        makeRequest(
          http2,
          {
            protocol,
            host,
            port,
            testing: { overrideHeaders: testHeaders }
          },
          finish
        )
      })

      function finish(err, headers) {
        const transaction = agent.getTransaction()
        const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.ok(!err)
        assert.equal(child.name, `External/${host}:${port}${path}`)
        assert.ok(headers.traceparent, 'traceparent header')
        const [version, traceId, parentSpanId, sampledFlag] = headers.traceparent.split('-')
        assert.equal(version, '00')
        assert.equal(traceId, transaction.traceId)
        assert.equal(parentSpanId, transaction.trace.root.id)
        assert.equal(sampledFlag, '01')
        end()
      }
    })

    await t.test(`header type (${requestHeaders}): should add CAT headers when 'cross_application_tracer' is enabled`, (t, end) => {
      const { agent, http2, protocol, host, port, path } = t.nr
      const encKey = 'testEncodingKey'
      agent.config.distributed_tracing.enabled = false
      agent.config.cross_application_tracer.enabled = true
      agent.config.encoding_key = encKey
      agent.config.trusted_account_ids = [123]
      const appData = ['123#456', 'abc', 0, 0, -1, 'xyz']
      const obfData = hashes.obfuscateNameUsingKey(JSON.stringify(appData), encKey)
      const testHeaders = formatHeaders({ 'x-newrelic-app-data': obfData, host: `${host}:${port}`, ':path': path, ':method': 'GET' }, requestHeaders)

      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            protocol,
            host,
            port,
            testing: { overrideHeaders: testHeaders }
          },
          finish
        )
      })

      function finish(err, headers) {
        assert.ok(!err)
        assert.ok(headers['x-newrelic-transaction'], 'New Relic header')
        assert.match(headers['x-newrelic-transaction'], /^[\w/-]{60,80}={0,2}$/)
        assert.ok(headers['x-newrelic-app-data'], 'New Relic app data header')
        end()
      }
    })

    await t.test(`header type (${requestHeaders}): should add synthetics header when it exists on transaction`, (t, end) => {
      const { agent, http2, protocol, host, port, path } = t.nr
      agent.config.encoding_key = 'testEncodingKey'
      const testHeaders = formatHeaders({ host: `${host}:${port}`, ':path': path, ':method': 'GET' }, requestHeaders)

      helper.runInTransaction(agent, function () {
        const tx = agent.getTransaction()
        tx.syntheticsHeader = 'synthHeader'
        tx.syntheticsInfoHeader = 'synthInfoHeader'
        t.nr.transaction = tx
        makeRequest(
          http2,
          {
            protocol,
            host,
            port,
            testing: { overrideHeaders: testHeaders }
          },
          finish
        )
      })

      function finish(err, headers) {
        assert.ok(!err)
        assert.ok(headers['x-newrelic-synthetics'], 'synthetics header')
        assert.equal(headers['x-newrelic-synthetics'], 'synthHeader')
        assert.ok(headers['x-newrelic-synthetics-info'], 'synthetics info header')
        assert.equal(headers['x-newrelic-synthetics-info'], 'synthInfoHeader')
        end()
      }
    })
  }
})

test('http2 error handling', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('agent should record if server returns an error', (t, end) => {
    const { agent, http2, protocol, host, port } = t.nr
    helper.runInTransaction(agent, async function () {
      t.nr.transaction = agent.getTransaction()
      assert.doesNotThrow(() => {
        makeRequest(
          http2,
          {
            protocol,
            host,
            port,
            path: '/errorCode?code=500',
            method: 'GET'
          },
          finish
        )
      })
      function finish(err) {
        const transaction = agent.getTransaction()
        const [, child] = transaction.trace.getChildren(transaction.trace.root.id)
        const spanAttributes = child.attributes.get(DESTINATIONS.SPAN_EVENT)

        assert.ok(err)
        assert.equal(err.code, 'ERR_HTTP2_STREAM_ERROR')
        assert.equal(spanAttributes['request.parameters.code'], 500)
        end()
      }
    })
  })

  await t.test('should collect errors only if they are not being handled', (t, end) => {
    const { agent, http2, protocol, host, port } = t.nr
    const path = '/'
    const emit = events.EventEmitter.prototype.emit
    events.EventEmitter.prototype.emit = function (evnt) {
      if (evnt === 'error') {
        this.once('error', function () {})
      }
      return emit.apply(this, arguments)
    }

    t.afterEach(() => {
      events.EventEmitter.prototype.emit = emit
    })

    helper.runInTransaction(agent, handled)
    const expectedCode = 'ERR_HTTP2_STREAM_ERROR'

    function handled(transaction) {
      const session = http2.connect(`${protocol}://${host}:${port}`)
      const req = session.request({
        ':path': '/destroy',
        ':method': 'GET'
      })

      req.on('close', function () {
        assert.equal(transaction.exceptions.length, 0)
        unhandled(transaction)
      })

      req.on('error', function (err) {
        assert.equal(err.code, expectedCode)
      })

      req.end()
    }

    function unhandled(transaction) {
      const session = http2.connect(`${protocol}://${host}:${port}${path}`)
      const req = session.request({
        ':path': '/destroy',
        ':method': 'GET'
      })

      req.on('close', function () {
        assert.equal(transaction.exceptions.length, 1)
        assert.equal(transaction.exceptions[0].error.code, expectedCode)
        end()
      })

      req.end()
    }
  })
})

// Unlike http, http2 requests take place after an explicit connect is invoked
async function makeRequest(http2, params, cb) {
  const { protocol, host, port, path, method, headers: requestHeaders, body = '', testing = {} } = params
  let connectUrl
  let pathstring = ''
  if (path) {
    pathstring = path
  }
  // protocol is required by http2.connect()
  if (!protocol) {
    connectUrl = port ? `${host}:${port}${pathstring}` : `${host}`
  } else {
    connectUrl = port ? `${protocol}://${host}:${port}${pathstring}` : `${protocol}://${host}`
  }

  const session = await http2.connect(connectUrl)

  const http2Headers = {}

  if (method) {
    http2Headers[':method'] = method
  }
  if (path) {
    http2Headers[':path'] = path
  }

  let combinedHeaders = { ...requestHeaders, ...http2Headers }
  if (testing?.headers) {
    combinedHeaders = { ...testing.headers, ...http2Headers }
  } else if (testing?.overrideHeaders) {
    combinedHeaders = testing.overrideHeaders
  }

  const req = session.request(combinedHeaders)
  req.on('error', function (err) {
    cb(err)
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

  if (body) {
    return req.end(body)
  }
  req.end()
}
