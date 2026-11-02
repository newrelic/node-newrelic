/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const test = require('node:test')
const symbols = require('#agentlib/symbols.js')
const { tspl } = require('@matteo.collina/tspl')
const net = require('net')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const fs = require('node:fs/promises')
const http = require('node:http')
const url = require('node:url')
const nock = require('nock')
const Tracestate = require('#agentlib/w3c/tracestate.js')
const testSignatures = require('./outbound-utils')

test('external requests', async function (t) {
  t.beforeEach((ctx) => {
    const agent = helper.instrumentMockedAgent()
    const http = require('http')
    ctx.nr = {
      agent,
      http
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('segments should end on error', async function (t) {
    const plan = tspl(t, { plan: 3 })
    const { agent, http } = t.nr
    const notVeryReliable = http.createServer(function badHandler(req) {
      req.socket.end()
    })

    t.after(() => {
      notVeryReliable.close()
    })

    notVeryReliable.listen(0)

    helper.runInTransaction(agent, function inTransaction(tx) {
      const req = http.get(notVeryReliable.address())

      req.on('error', function onError() {
        const [segment] = tx.trace.getChildren(tx.trace.root.id)

        plan.equal(
          segment.name,
          'External/localhost:' + notVeryReliable.address().port + '/',
          'should be named'
        )
        plan.ok(segment.timer.start, 'should have started')
        plan.ok(segment.timer.hasEnd(), 'should have ended')
      })
    })

    await plan.completed
  })

  await t.test('should have expected child segments', async function (t) {
    const plan = tspl(t, { plan: 7 })
    const { agent, http } = t.nr
    // The externals segment is based on the lifetime of the request and response.
    // These objects are event emitters and we consider the external to be
    // completed when the response emits `end`. Since there are actions that
    // happen throughout the requests lifetime on other events, each of those
    // sequences will be their own tree under the main external call. This
    // results in a tree with several sibling branches that might otherwise be
    // shown in a hierarchy. This is okay.
    const server = http.createServer(function (req, res) {
      req.resume()
      res.end('ok')
    })
    t.after(function () {
      server.close()
    })

    server.listen(0)

    helper.runInTransaction(agent, function inTransaction(tx) {
      const url = 'http://localhost:' + server.address().port + '/some/path'
      http.get(url, function onResponse(res) {
        res.resume()
        res.once('end', function resEnded() {
          setTimeout(function timeout() {
            check(tx)
          }, 10)
        })
      })
    })

    function check(tx) {
      const [external] = tx.trace.getChildren(tx.trace.root.id)
      plan.equal(
        external.name,
        'External/localhost:' + server.address().port + '/some/path',
        'should be named as an external'
      )
      plan.ok(external.timer.start, 'should have started')
      plan.ok(external.timer.hasEnd(), 'should have ended')
      const externalChildren = tx.trace.getChildren(external.id)
      plan.ok(externalChildren.length, 'should have children')

      let connect = externalChildren[0]
      plan.equal(connect.name, 'http.Agent#createConnection', 'should be connect segment')
      let connectChildren = tx.trace.getChildren(connect.id)
      plan.equal(connectChildren.length, 1, 'connect should have 1 child')

      // as of Node 24.5.0 there's yet another layer of net segments
      if (connectChildren[0].name === 'net.createConnection') {
        connectChildren = tx.trace.getChildren(connectChildren[0].id)
      }
      // There is potentially an extra layer of create/connect segments.
      if (connectChildren[0].name === 'net.Socket.connect') {
        connect = connectChildren[0]
      }

      connectChildren = tx.trace.getChildren(connect.id)

      const dnsLookup = connectChildren[0]
      plan.equal(dnsLookup.name, 'dns.lookup', 'should be dns.lookup segment')
    }

    await plan.completed
  })

  await t.test('NODE-1647 should not interfere with `got`', { timeout: 5000 }, async function (t) {
    const plan = tspl(t, { plan: 1 })
    const { agent } = t.nr
    // Our way of wrapping HTTP response objects caused `got` to hang. This was
    // resolved in agent 2.5.1.
    nock.disableNetConnect()
    t.after(() => {
      nock.enableNetConnect()
    })
    nock('https://example.com').get('/').reply(200, '', { 'Content-Length': '0' })
    const got = require('got').default
    await helper.runInTransaction(agent, async function () {
      await got('https://example.com/')
      plan.ok(true)
    })
  })

  await t.test('unix sockets', async function(t) {
    const { agent, http } = t.nr
    const plan = tspl(t, { plan: 2 })
    const socketPath = './test.sock'
    try {
      await fs.unlink(socketPath)
    } catch {
      // this is defensive code in case a socket was dangling
    }
    const server = net.createServer((socket) => {
      socket.on('data', () => {
        socket.end('HTTP/1.1 200 OK\r\n\r\n')
      })
    })

    await new Promise((resolve) => {
      server.listen(socketPath, resolve)
    })
    t.after(() => {
      server.close()
    })

    await helper.runInTransaction(agent, async function () {
      await new Promise((resolve) => {
        http.get({ host: '::1', socketPath }, (res) => {
          const segment = agent.tracer.getSegment()
          plan.equal(segment.name, 'External/::1')
          const attributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
          plan.deepEqual(attributes, {
            hostname: '::1',
            port: 80,
            url: 'http://::1/',
            procedure: 'GET',
            'http.statusCode': 200,
            'http.statusText': 'OK'
          })
          res.resume()
          resolve()
        })
      })
    })
    await plan.completed
  })

  await t.test('should record requests to default ports', async (t) => {
    const plan = tspl(t, { plan: 1 })
    const { agent, http } = t.nr
    nock.disableNetConnect()
    t.after(() => {
      nock.enableNetConnect()
    })
    nock('http://example.com').get('/').reply(200, '', { 'Content-Length': '0' })
    helper.runInTransaction(agent, (tx) => {
      http.get('http://example.com/', (res) => {
        res.resume()
        res.on('end', () => {
          const [segment] = tx.trace.getChildren(tx.trace.root.id)
          plan.equal(segment.name, 'External/example.com/', 'should create external segment')
        })
      })
    })

    await plan.completed
  })

  await t.test('should expose the external segment on the http request', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, http } = t.nr
    nock.disableNetConnect()
    t.after(() => {
      nock.enableNetConnect()
    })
    nock('http://example.com').get('/').reply(200, '', { 'Content-Length': '0' })
    helper.runInTransaction(agent, (tx) => {
      let reqSegment = null
      const req = http.get('http://example.com/', (res) => {
        res.resume()
        res.on('end', () => {
          const [segment] = tx.trace.getChildren(tx.trace.root.id)
          const attrs = segment.getAttributes()
          plan.deepEqual(attrs, {
            url: 'http://example.com/',
            procedure: 'GET'
          })
          plan.equal(reqSegment, segment, 'should expose external')
        })
      })
      reqSegment = req[symbols.segment]
    })

    await plan.completed
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
      // We are purposefully using `url.parse` here in order to verify that our
      // implementation results in the same shape data as that returned by `url.parse`.
      // See: https://github.com/newrelic/node-newrelic/blob/2077ce35db319d0128337faed0ff77b00f76d8f1/lib/instrumentation/core/http.js#L390
      // eslint-disable-next-line n/no-deprecated-api
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

  await t.test('generates dt and w3c trace context headers to outbound request when exclude_newrelic_header: false', (t, end) => {
    const { agent } = t.nr
    agent.config.trusted_account_key = 190
    agent.config.account_id = 190
    agent.config.primary_application_id = '389103'
    agent.config.distributed_tracing.exclude_newrelic_header = false

    let headers
    nock('http://www.google.com')
      .get('/index.html')
      .reply(200, function () {
        headers = this.req.headers
      })

    // nock 14 (mswjs) discards agent-injected headers when normalizing a URL
    // string into request options. Passing an options object bypasses that
    // normalization and keeps this.req.headers intact in the reply callback.
    helper.runInTransaction(agent, (transaction) => {
      http.get({ hostname: 'www.google.com', port: 80, path: '/index.html' }, (res) => {
        const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.equal(segment.name, 'External/www.google.com/index.html')
        assert.ok(headers.traceparent, 'traceparent header')
        const [version, traceId, parentSpanId, sampledFlag] = headers.traceparent.split('-')
        assert.equal(version, '00')
        assert.equal(traceId, transaction.traceId)
        assert.equal(parentSpanId, segment.id)
        assert.equal(sampledFlag, '01')
        assert.ok(headers.tracestate, 'tracestate header')
        assert.ok(!headers.tracestate.includes('null'))
        assert.ok(!headers.tracestate.includes('true'))
        assert.ok(headers.newrelic, 'newrelic dt header')
        const valid = Tracestate.fromHeader({ header: headers.tracestate, agent })
        assert.ok(valid.intrinsics)
        res.resume()
        transaction.end()
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

    let headers
    nock('http://www.google.com')
      .get('/index.html')
      .reply(200, function () {
        headers = this.req.headers
      })

    // nock 14 (mswjs) discards agent-injected headers when normalizing a URL
    // string into request options. Passing an options object bypasses that
    // normalization and keeps this.req.headers intact in the reply callback.
    helper.runInTransaction(agent, (transaction) => {
      http.get({ hostname: 'www.google.com', port: 80, path: '/index.html' }, (res) => {
        assert.ok(headers.traceparent)
        assert.equal(headers.traceparent.split('-').length, 4)
        assert.ok(headers.tracestate)
        assert.ok(!headers.tracestate.includes('null'))
        assert.ok(!headers.tracestate.includes('true'))
        assert.ok(!headers.newrelic)
        const valid = Tracestate.fromHeader({ header: headers.tracestate, agent })
        assert.ok(valid.intrinsics)
        res.resume()
        transaction.end()
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
    ctx.nr.nock = nock
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
