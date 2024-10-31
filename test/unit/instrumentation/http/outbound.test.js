/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const http = require('http')
const url = require('url')
const events = require('events')
const helper = require('../../../lib/agent_helper')
const NAMES = require('../../../../lib/metrics/names')
const instrumentOutbound = require('../../../../lib/instrumentation/core/http-outbound')
const hashes = require('../../../../lib/util/hashes')
const nock = require('nock')
const Segment = require('../../../../lib/transaction/trace/segment')
const { DESTINATIONS } = require('../../../../lib/config/attribute-filter')
const symbols = require('../../../../lib/symbols')
const HOSTNAME = 'localhost'
const PORT = 8890
const testSignatures = require('./outbound-utils')

function addSegment({ agent }) {
  const transaction = agent.getTransaction()
  transaction.type = 'web'
  transaction.baseSegment = new Segment({
    config: agent.config,
    name: 'base-segment',
    root: transaction.trace.root
  })
}

test('instrumentOutbound', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test(
    'should omit query parameters from path if attributes.enabled is false',
    (t, end) => {
      const { agent } = t.nr
      agent.config.attributes.enabled = false
      const req = new events.EventEmitter()
      helper.runInTransaction(agent, function (transaction) {
        instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.deepEqual(child.getAttributes(), {})

        function makeFakeRequest() {
          req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
          return req
        }
        end()
      })
    }
  )

  await t.test('should omit query parameters from path if high_security is true', (t, end) => {
    const { agent } = t.nr
    agent.config.high_security = true
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.deepEqual(child.getAttributes(), {
        procedure: 'GET',
        url: `http://${HOSTNAME}:${PORT}/asdf`
      })

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
      end()
    })
  })

  await t.test('should obfuscate url path if url_obfuscation regex pattern is set', (t, end) => {
    const { agent } = t.nr
    agent.config.url_obfuscation = {
      enabled: true,
      regex: {
        pattern: '.*',
        replacement: '/***'
      }
    }
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.deepEqual(child.getAttributes(), {
        procedure: 'GET',
        url: `http://${HOSTNAME}:${PORT}/***`
      })

      function makeFakeRequest() {
        req.path = '/asdf/foo/bar/baz?test=123&test2=456'
        return req
      }
      end()
    })
  })

  await t.test('should strip query parameters from path in transaction trace segment', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      const path = '/asdf'
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path

      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
      end()
    })
  })

  await t.test('should save query parameters from path if attributes.enabled is true', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      agent.config.attributes.enabled = true
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.deepEqual(
        child.attributes.get(DESTINATIONS.SPAN_EVENT),
        {
          hostname: HOSTNAME,
          port: PORT,
          url: `http://${HOSTNAME}:${PORT}/asdf`,
          procedure: 'GET',
          'request.parameters.a': 'b',
          'request.parameters.another': 'yourself',
          'request.parameters.thing': true,
          'request.parameters.grownup': 'true'
        },
        'adds attributes to spans'
      )

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
      end()
    })
  })

  await t.test('should not accept an undefined path', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      assert.throws(
        () => instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest),
        Error
      )
      end()
    })

    function makeFakeRequest() {
      return req
    }
  })

  await t.test('should accept a simple path with no parameters', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    const path = '/newrelic'
    helper.runInTransaction(agent, function (transaction) {
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path
      req.path = path
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
      end()
    })

    function makeFakeRequest() {
      req.path = path
      return req
    }
  })

  await t.test('should purge trailing slash', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    const path = '/newrelic/'
    helper.runInTransaction(agent, function (transaction) {
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + '/newrelic'
      req.path = path
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
    })

    function makeFakeRequest() {
      req.path = path
      return req
    }
    end()
  })

  await t.test('should not throw if hostname is undefined', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()

    helper.runInTransaction(agent, function () {
      let req2 = null
      assert.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { port: PORT }, makeFakeRequest)
      })

      assert.equal(req2, req)
      assert.ok(!req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    end()
  })

  await t.test('should not throw if hostname is null', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()

    helper.runInTransaction(agent, function () {
      let req2 = null
      assert.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { host: null, port: PORT }, makeFakeRequest)
      })

      assert.equal(req2, req)
      assert.ok(!req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    end()
  })

  await t.test('should not throw if hostname is an empty string', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      let req2 = null
      assert.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { host: '', port: PORT }, makeFakeRequest)
      })

      assert.equal(req2, req)
      assert.ok(!req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    end()
  })

  await t.test('should not throw if port is undefined', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()

    helper.runInTransaction(agent, function () {
      let req2 = null
      assert.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { host: 'hostname' }, makeFakeRequest)
      })

      assert.equal(req2, req)
      assert.ok(!req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    end()
  })

  await t.test('should not crash when req.headers is null', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      const path = '/asdf'

      instrumentOutbound(agent, { headers: null, host: HOSTNAME, port: PORT }, makeFakeRequest)

      function makeFakeRequest(opts) {
        assert.ok(opts.headers, 'should assign headers when null')
        assert.ok(opts.headers.traceparent, 'traceparent should exist')
        req.path = path
        return req
      }
    })
    end()
  })
})

test('should add data from cat header to segment', async (t) => {
  const encKey = 'gringletoes'
  const appData = ['123#456', 'abc', 0, 0, -1, 'xyz']

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      cross_application_tracer: { enabled: true },
      distributed_tracing: { enabled: false },
      encoding_key: encKey,
      trusted_account_ids: [123]
    })
    const obfData = hashes.obfuscateNameUsingKey(JSON.stringify(appData), encKey)
    const server = http.createServer(function (req, res) {
      res.writeHead(200, { 'x-newrelic-app-data': obfData })
      res.end()
      req.resume()
    })
    ctx.nr.server = server

    return new Promise((resolve) => {
      helper.randomPort((port) => {
        server.listen(port, resolve)
      })
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    return new Promise((resolve) => {
      ctx.nr.server.close(resolve)
    })
  })

  await t.test('should use config.obfuscatedId as the x-newrelic-id header', (t, end) => {
    const { agent, server } = t.nr
    helper.runInTransaction(agent, function () {
      addSegment({ agent })

      const port = server.address().port
      http
        .get({ host: 'localhost', port }, function (res) {
          const segment = agent.tracer.getSegment()

          assert.equal(segment.catId, '123#456')
          assert.equal(segment.catTransaction, 'abc')
          assert.equal(segment.name, `ExternalTransaction/localhost:${port}/123#456/abc`)
          assert.equal(segment.getAttributes().transaction_guid, 'xyz')
          res.resume()
          agent.getTransaction().end()
          end()
        })
        .end()
    })
  })

  await t.test('should not explode with invalid data', (t, end) => {
    const { agent, server } = t.nr
    helper.runInTransaction(agent, function () {
      addSegment({ agent })

      const port = server.address().port
      http
        .get({ host: 'localhost', port }, function (res) {
          const segment = agent.tracer.getSegment()

          assert.equal(segment.catId, '123#456')
          assert.equal(segment.catTransaction, 'abc')
          // TODO: port in metric is a known bug. issue #142
          assert.equal(segment.name, `ExternalTransaction/localhost:${port}/123#456/abc`)
          assert.equal(segment.getAttributes().transaction_guid, 'xyz')
          res.resume()
          agent.getTransaction().end()
          end()
        })
        .end()
    })
  })

  await t.test('should collect errors only if they are not being handled', (t, end) => {
    const { agent } = t.nr
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
    const expectedCode = 'ECONNREFUSED'

    function handled(transaction) {
      const req = http.get({ host: 'localhost', port: 12345 }, function () {})

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
      const req = http.get({ host: 'localhost', port: 12345 }, function () {})

      req.on('close', function () {
        assert.equal(transaction.exceptions.length, 1)
        assert.equal(transaction.exceptions[0].error.code, expectedCode)
        end()
      })

      req.end()
    }
  })
})

test('when working with http.request', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
    ctx.nr.tracer = helper.getTracer()

    nock.disableNetConnect()
  })

  t.afterEach((ctx) => {
    nock.enableNetConnect()
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should accept port and hostname', (t, end) => {
    const { agent, tracer } = t.nr
    const host = 'http://www.google.com'
    const path = '/index.html'
    nock(host).get(path).reply(200, 'Hello from Google')

    helper.runInTransaction(agent, function (transaction) {
      http.get('http://www.google.com/index.html', function (res) {
        const segment = tracer.getSegment()

        assert.equal(segment.name, 'External/www.google.com/index.html')
        res.resume()
        transaction.end()
        end()
      })
    })
  })

  await t.test('should conform to external segment spec', (t, end) => {
    const { agent } = t.nr
    const host = 'http://www.google.com'
    const path = '/index.html'
    nock(host).post(path).reply(200)

    helper.runInTransaction(agent, function (transaction) {
      const opts = url.parse(`${host}${path}`)
      opts.method = 'POST'

      const req = http.request(opts, function (res) {
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        const attributes = child.getAttributes()
        assert.equal(attributes.url, 'http://www.google.com/index.html')
        assert.equal(attributes.procedure, 'POST')
        res.resume()
        transaction.end()
        end()
      })
      req.end()
    })
  })

  await t.test('should start and end segment', (t, end) => {
    const { agent, tracer } = t.nr
    const host = 'http://www.google.com'
    const path = '/index.html'
    nock(host).get(path).delay(10).reply(200, 'Hello from Google')

    helper.runInTransaction(agent, function (transaction) {
      http.get('http://www.google.com/index.html', function (res) {
        const segment = tracer.getSegment()

        assert.ok(segment.timer.hrstart instanceof Array)
        assert.equal(segment.timer.hrDuration, null)

        res.resume()
        res.on('end', function onEnd() {
          assert.ok(segment.timer.hrDuration instanceof Array)
          assert.ok(segment.timer.getDurationInMillis() > 0)
          transaction.end()
          end()
        })
      })
    })
  })

  await t.test('should not modify parent segment when parent segment opaque', (t, end) => {
    const { agent, tracer } = t.nr
    const host = 'http://www.google.com'
    const paramName = 'testParam'
    const path = `/index.html?${paramName}=value`

    nock(host).get(path).reply(200, 'Hello from Google')

    helper.runInTransaction(agent, (transaction) => {
      const parentSegment = agent.tracer.createSegment({
        name: 'ParentSegment',
        parent: transaction.trace.root,
        transaction
      })
      parentSegment.opaque = true

      tracer.setSegment({ transaction, segment: parentSegment }) // make the current active segment

      http.get(`${host}${path}`, (res) => {
        const segment = tracer.getSegment()

        assert.equal(segment, parentSegment)
        assert.equal(segment.name, 'ParentSegment')

        const attributes = segment.getAttributes()

        assert.ok(!attributes.url)

        assert.ok(!attributes[`request.parameters.${paramName}`])

        res.resume()
        transaction.end()
        end()
      })
    })
  })

  await t.test('generates dt and w3c trace context headers to outbound request', (t, end) => {
    const { agent } = t.nr
    agent.config.trusted_account_key = 190
    agent.config.account_id = 190
    agent.config.primary_application_id = '389103'
    const host = 'http://www.google.com'
    const path = '/index.html'
    let headers

    nock(host)
      .get(path)
      .reply(200, function () {
        headers = this.req.headers
        assert.ok(headers.traceparent, 'traceparent header')
        assert.equal(headers.traceparent.split('-').length, 4)
        assert.ok(headers.tracestate, 'tracestate header')
        assert.ok(!headers.tracestate.includes('null'))
        assert.ok(!headers.tracestate.includes('true'))

        assert.ok(headers.newrelic, 'dt headers')
      })

    helper.runInTransaction(agent, (transaction) => {
      http.get(`${host}${path}`, (res) => {
        res.resume()
        transaction.end()
        const tc = transaction.traceContext
        const valid = tc._validateAndParseTraceStateHeader(headers.tracestate)
        assert.ok(valid.entryValid)
        end()
      })
    })
  })

  await t.test('should only add w3c header when exclude_newrelic_header: true', (t, end) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.exclude_newrelic_header = true
    agent.config.trusted_account_key = 190
    agent.config.account_id = 190
    agent.config.primary_application_id = '389103'
    const host = 'http://www.google.com'
    const path = '/index.html'
    let headers

    nock(host)
      .get(path)
      .reply(200, function () {
        headers = this.req.headers
        assert.ok(headers.traceparent)
        assert.equal(headers.traceparent.split('-').length, 4)
        assert.ok(headers.tracestate)
        assert.ok(!headers.tracestate.includes('null'))
        assert.ok(!headers.tracestate.includes('true'))

        assert.ok(!headers.newrelic)
      })

    helper.runInTransaction(agent, (transaction) => {
      http.get(`${host}${path}`, (res) => {
        res.resume()
        transaction.end()
        const tc = transaction.traceContext
        const valid = tc._validateAndParseTraceStateHeader(headers.tracestate)
        assert.equal(valid.entryValid, true)
        end()
      })
    })
  })
})

test('Should properly handle http(s) get and request signatures', async (t) => {
  function beforeTest(ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
    ctx.nr.tracer = helper.getTracer()
    nock.disableNetConnect()
  }

  function afterTest(ctx) {
    nock.enableNetConnect()
    helper.unloadAgent(ctx.nr.agent)
  }

  await t.test('http.get', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await testSignatures('http', 'get', t)
  })

  await t.test('http.request', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await testSignatures('http', 'request', t)
  })

  await t.test('https.get', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await testSignatures('https', 'get', t)
  })

  await t.test('https.request', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await testSignatures('https', 'request', t)
  })
})
