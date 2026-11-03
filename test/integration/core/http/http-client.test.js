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
const https = require('node:https')
const url = require('node:url')
const nock = require('nock')
const Tracestate = require('#agentlib/w3c/tracestate.js')
const testSignatures = require('./outbound-utils')
const NAMES = require('#agentlib/metrics/names.js')
const HOSTNAME = 'localhost'
const PORT = 8890

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

/**
 * Issues a request with `http.request` and immediately destroys it. These tests
 * only assert on the external segment, which is complete once `request()`
 * returns, so the request never needs to reach a server (nothing listens on
 * `PORT`).
 *
 * @param {object} opts The HTTP request options.
 * @returns {http.ClientRequest} The destroyed request.
 */
function makeRequest(opts) {
  const req = http.request(opts)
  // handled so the destroyed request's error isn't thrown
  req.on('error', () => {})
  req.destroy()
  return req
}

/**
 * Gets the external segments directly under the transaction's root segment.
 *
 * @param {Transaction} transaction The transaction to inspect.
 * @returns {TraceSegment[]} The external segments.
 */
function getExternalSegments(transaction) {
  return transaction.trace
    .getChildren(transaction.trace.root.id)
    .filter((segment) => segment.name.startsWith(NAMES.EXTERNAL.PREFIX))
}

/**
 * Asserts the agent recorded exactly the expected `External/` metrics, each
 * called once.
 *
 * @param {Agent} agent The agent that recorded the metrics.
 * @param {object} expected The expected metrics.
 * @param {string[]} expected.unscoped The names of the unscoped external metrics.
 * @param {object} [expected.scoped] The names of the scoped external metrics, keyed by scope.
 */
function assertExternalMetrics(agent, { unscoped, scoped = {} }) {
  const metrics = agent.metrics._metrics
  const externalNames = (stats) => Object.keys(stats).filter((name) => name.startsWith(NAMES.EXTERNAL.PREFIX)).sort()

  assert.deepEqual(externalNames(metrics.unscoped), [...unscoped].sort(), 'should record the expected unscoped external metrics')
  const recordedScopes = Object.keys(metrics.scoped).filter((scope) => externalNames(metrics.scoped[scope]).length > 0)
  assert.deepEqual(recordedScopes.sort(), Object.keys(scoped).sort(), 'should record external metrics under the expected scopes')
  for (const [scope, names] of Object.entries(scoped)) {
    assert.deepEqual(externalNames(metrics.scoped[scope]), [...names].sort(), `should record the expected external metrics scoped to ${scope}`)
  }

  const recorded = [...unscoped.map((name) => metrics.unscoped[name])]
  for (const [scope, names] of Object.entries(scoped)) {
    recorded.push(...names.map((name) => metrics.scoped[scope][name]))
  }
  for (const stats of recorded) {
    assert.equal(stats.callCount, 1, 'should record each external metric once')
  }
}

/**
 * Gets the attributes a span event sends, without the duration the agent
 * computes for every span.
 *
 * @param {object} span The span event.
 * @returns {object} The span's non-null attributes.
 */
function getSpanAttributes(span) {
  const { nr_exclusive_duration_millis: duration, ...attributes } = span.toJSON()[2]
  assert.equal(typeof duration, 'number', 'should record the exclusive duration')
  return attributes
}

test('HttpClientSubscriber', async (t) => {
  // nock replaces `http.ClientRequest` and rejects options it cannot parse into
  // a URL (e.g. an invalid `href`), so use the real one; requests are destroyed
  // before they connect
  t.before(() => {
    nock.restore()
  })

  t.after(() => {
    nock.activate()
  })

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test(
    'should omit query parameters from path if attributes.enabled is false',
    (t, end) => {
      const { agent } = t.nr
      agent.config.attributes.enabled = false
      helper.runInTransaction(agent, function (transaction) {
        makeRequest({ host: HOSTNAME, port: PORT, path: '/asdf?a=b&another=yourself&thing&grownup=true' })
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.deepEqual(child.getAttributes(), {})
        end()
      })
    }
  )

  await t.test('should omit query parameters from path if high_security is true', (t, end) => {
    const { agent } = t.nr
    agent.config.high_security = true
    helper.runInTransaction(agent, function (transaction) {
      makeRequest({ host: HOSTNAME, port: PORT, path: '/asdf?a=b&another=yourself&thing&grownup=true' })
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.deepEqual(child.getAttributes(), {
        procedure: 'GET',
        url: `http://${HOSTNAME}:${PORT}/asdf`
      })
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
    helper.runInTransaction(agent, function (transaction) {
      makeRequest({ host: HOSTNAME, port: PORT, path: '/asdf/foo/bar/baz?test=123&test2=456' })
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.deepEqual(child.getAttributes(), {
        procedure: 'GET',
        url: `http://${HOSTNAME}:${PORT}/***`
      })
      end()
    })
  })

  await t.test('should strip query parameters from path in transaction trace segment', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + '/asdf'

      makeRequest({ host: HOSTNAME, port: PORT, path: '/asdf?a=b&another=yourself&thing&grownup=true' })
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
      end()
    })
  })

  await t.test('should save query parameters from path if attributes.enabled is true', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      agent.config.attributes.enabled = true
      makeRequest({ host: HOSTNAME, port: PORT, path: '/asdf?a=b&another=yourself&thing&grownup=true' })
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
      end()
    })
  })

  await t.test('should accept a simple path with no parameters', (t, end) => {
    const { agent } = t.nr
    const path = '/newrelic'
    helper.runInTransaction(agent, function (transaction) {
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path
      makeRequest({ host: HOSTNAME, port: PORT, path })
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
      end()
    })
  })

  await t.test('should purge trailing slash', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + '/newrelic'
      makeRequest({ host: HOSTNAME, port: PORT, path: '/newrelic/' })
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
      end()
    })
  })

  await t.test('should not throw if hostname is undefined', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      let req = null
      assert.doesNotThrow(() => {
        req = makeRequest({ port: PORT, path: '/newrelic' })
      })

      assert.ok(req instanceof http.ClientRequest)
      assert.ok(!req[symbols.transactionInfo])
      end()
    })
  })

  await t.test('should not throw if hostname is null', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      let req = null
      assert.doesNotThrow(() => {
        req = makeRequest({ host: null, port: PORT, path: '/newrelic' })
      })

      assert.ok(req instanceof http.ClientRequest)
      assert.ok(!req[symbols.transactionInfo])
      end()
    })
  })

  await t.test('should not throw if hostname is an empty string', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      let req = null
      assert.doesNotThrow(() => {
        req = makeRequest({ host: '', port: PORT, path: '/newrelic' })
      })

      assert.ok(req instanceof http.ClientRequest)
      assert.ok(!req[symbols.transactionInfo])
      end()
    })
  })

  await t.test('should not throw if port is undefined', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      let req = null
      assert.doesNotThrow(() => {
        req = makeRequest({ host: 'hostname', path: '/newrelic' })
      })

      assert.ok(req instanceof http.ClientRequest)
      assert.ok(!req[symbols.transactionInfo])
      end()
    })
  })

  await t.test('should not crash when req.headers is null', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      const req = makeRequest({ headers: null, host: HOSTNAME, port: PORT, path: '/asdf' })
      assert.ok(req.getHeader('traceparent'), 'traceparent should exist')
      end()
    })
  })

  await t.test('should prioritize using href', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      const href = `http://${HOSTNAME}:${PORT}/someother/path/more?query=string`

      makeRequest({ href, host: HOSTNAME, port: PORT, path: '/someother/path' })

      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.ok(child.name.includes('someother/path/more'), 'should use href over request.path')
      end()
    })
  })

  await t.test('should construct url from protocol, host header and path when path is not a substring of href', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      const path = '/fallback/path'
      const href = 'not-a-valid-url'

      makeRequest({ href, host: HOSTNAME, port: PORT, path })

      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.ok(child.name.includes(path), 'should use request.path when href is invalid')
      end()
    })
  })

  await t.test('should not record requests marked off the record', (t, end) => {
    helper.runInTransaction(t.nr.agent, function (transaction) {
      const req = makeRequest({ host: HOSTNAME, port: PORT, path: '/newrelic', [symbols.offTheRecord]: true })

      const children = transaction.trace.getChildren(transaction.trace.root.id)
      assert.ok(!children.some((child) => child.name.startsWith(NAMES.EXTERNAL.PREFIX)), 'should not create an external segment')
      assert.ok(!req.getHeader('traceparent'), 'should not add tracing headers')
      assert.ok(!req[symbols.segment])
      transaction.end()
      assertExternalMetrics(t.nr.agent, { unscoped: [] })
      end()
    })
  })

  await t.test('should not record requests outside of a transaction', () => {
    const req = makeRequest({ host: HOSTNAME, port: PORT, path: '/newrelic' })

    assert.ok(!req.getHeader('traceparent'), 'should not add tracing headers')
    assert.ok(!req[symbols.segment])
  })

  await t.test('should keep the port and credentials of a url string', (t, end) => {
    helper.runInTransaction(t.nr.agent, function (transaction) {
      const req = http.request(`http://user:pass@${HOSTNAME}:${PORT}/newrelic?a=b`)
      req.on('error', () => {})

      const [child] = getExternalSegments(transaction)
      assert.equal(child.name, `${NAMES.EXTERNAL.PREFIX}${HOSTNAME}:${PORT}/newrelic`)
      // the credentials must not be recorded in the url
      assert.deepEqual(child.attributes.get(DESTINATIONS.SPAN_EVENT), {
        hostname: HOSTNAME,
        port: PORT,
        url: `http://${HOSTNAME}:${PORT}/newrelic`,
        procedure: 'GET',
        'request.parameters.a': 'b'
      })
      const credentials = Buffer.from('user:pass').toString('base64')
      assert.equal(req.getHeader('authorization'), `Basic ${credentials}`, 'should pass the credentials to http')
      req.destroy()
      end()
    })
  })

  await t.test('should remove the brackets from an ipv6 url string host', (t, end) => {
    helper.runInTransaction(t.nr.agent, function (transaction) {
      const req = http.request(`http://[::1]:${PORT}/newrelic`)
      req.on('error', () => {})

      const [child] = getExternalSegments(transaction)
      assert.equal(child.name, `${NAMES.EXTERNAL.PREFIX}::1:${PORT}/newrelic`)
      assert.deepEqual(child.attributes.get(DESTINATIONS.SPAN_EVENT), {
        hostname: '::1',
        port: PORT,
        url: `http://::1:${PORT}/newrelic`,
        procedure: 'GET'
      })
      req.destroy()
      end()
    })
  })

  await t.test('should not create a segment when the port is invalid', (t, end) => {
    helper.runInTransaction(t.nr.agent, function (transaction) {
      // `createConnection` hands http an unconnected socket, so the request is
      // created without `net` rejecting the port
      const createConnection = () => new net.Socket()
      const req = http.request({ host: HOSTNAME, port: -1, path: '/newrelic', createConnection })
      req.on('error', () => {})

      assert.equal(getExternalSegments(transaction).length, 0)
      assert.ok(!req[symbols.segment])
      req.destroy()
      end()
    })
  })

  const disableDtHeaders = [
    ['the x-new-relic-disable-dt header', { 'x-new-relic-disable-dt': 'true' }],
    ['the disableDT symbol', { [symbols.disableDT]: true }]
  ]
  for (const [label, headers] of disableDtHeaders) {
    await t.test(`should not add distributed tracing headers when disabled by ${label}`, (t, end) => {
      helper.runInTransaction(t.nr.agent, function (transaction) {
        const req = makeRequest({ host: HOSTNAME, port: PORT, path: '/newrelic', headers })

        assert.ok(!req.getHeader('traceparent'), 'should not add traceparent')
        assert.ok(!req.getHeader('tracestate'), 'should not add tracestate')
        assert.equal(getExternalSegments(transaction).length, 1, 'should still record the external')
        end()
      })
    })
  }

  const proxyTargets = [
    ['http', 'http://example.com/foo?a=b', 'http://example.com/foo', '80'],
    ['https', 'https://example.com/foo?a=b', 'https://example.com/foo', '443']
  ]
  for (const [protocol, path, url, port] of proxyTargets) {
    await t.test(`should record the target of an ${protocol} proxy request`, (t, end) => {
      helper.runInTransaction(t.nr.agent, function (transaction) {
        makeRequest({ host: HOSTNAME, port: PORT, path })

        const [child] = getExternalSegments(transaction)
        assert.equal(child.name, `${NAMES.EXTERNAL.PREFIX}example.com/foo`)
        assert.deepEqual(child.getAttributes(), { url, procedure: 'GET' })
        assert.deepEqual(child.attributes.get(DESTINATIONS.SPAN_EVENT), {
          hostname: 'example.com',
          port,
          url,
          procedure: 'GET',
          'request.parameters.a': 'b'
        })
        transaction.end()
        // the metrics are named for the proxy target, not the proxy
        assertExternalMetrics(t.nr.agent, {
          unscoped: ['External/example.com/http', 'External/example.com/all', 'External/allWeb', 'External/all']
        })
        end()
      })
    })
  }

  await t.test('should fall back to the request path when the url cannot be parsed', (t, end) => {
    helper.runInTransaction(t.nr.agent, function (transaction) {
      // the href includes the path, so it is used, but it is not a valid url
      makeRequest({ href: 'not-a-valid-url/newrelic', host: HOSTNAME, port: PORT, path: '/newrelic' })

      const [child] = getExternalSegments(transaction)
      assert.equal(child.name, `${NAMES.EXTERNAL.PREFIX}${HOSTNAME}:${PORT}`, 'should not add the path to the name')
      assert.deepEqual(child.getAttributes(), {
        procedure: 'GET',
        url: `http://${HOSTNAME}:${PORT}/newrelic`
      })
      end()
    })
  })

  await t.test('should end the segment and not capture an error the user handles', (t, end) => {
    helper.runInTransaction(t.nr.agent, function (transaction) {
      const req = http.request({ host: HOSTNAME, port: PORT, path: '/newrelic' })
      req.on('error', () => {})
      const [child] = getExternalSegments(transaction)

      req.emit('error', new Error('boom'))

      assert.equal(child.timer.isActive(), false, 'should end the segment')
      assert.equal(transaction.exceptions.length, 0, 'should not capture the error')
      req.destroy()
      transaction.end()
      assert.equal(t.nr.agent.errors.traceAggregator.errors.length, 0, 'should not collect an error trace')
      end()
    })
  })

  await t.test('should capture an error the user does not handle', (t, end) => {
    helper.runInTransaction(t.nr.agent, function (transaction) {
      const req = http.request({ host: HOSTNAME, port: PORT, path: '/newrelic' })
      const [child] = getExternalSegments(transaction)
      const error = new Error('boom')

      // with no listener the emitter rethrows, as it would without the agent
      assert.throws(() => req.emit('error', error), error)

      assert.equal(child.timer.isActive(), false, 'should end the segment')
      assert.equal(transaction.exceptions.length, 1, 'should capture the error')
      assert.equal(transaction.exceptions[0].error, error)
      req.on('error', () => {})
      req.destroy()

      const { agent } = t.nr
      transaction.end()
      // the failed request is still recorded as an external call
      assertExternalMetrics(agent, {
        unscoped: [`External/${HOSTNAME}:${PORT}/http`, `External/${HOSTNAME}:${PORT}/all`, 'External/allWeb', 'External/all']
      })
      assert.equal(agent.errors.traceAggregator.errors.length, 1, 'should collect one error trace')
      const [trace] = agent.errors.traceAggregator.errors
      assert.equal(trace[2], 'boom', 'should collect an error trace with the message')
      assert.equal(trace[3], 'Error', 'should collect an error trace with the class')
      const [[event]] = agent.errors.eventAggregator.getEvents()
      assert.equal(event['error.message'], 'boom', 'should collect an error event')
      assert.equal(agent.metrics.getMetric('Errors/all').callCount, 1, 'should record an error metric')
      end()
    })
  })

  await t.test('should add tracing headers when the request headers are an array', async (t) => {
    let received
    const server = http.createServer((req, res) => {
      received = req.headers
      res.end()
    })
    await new Promise((resolve) => server.listen(0, resolve))
    t.after(() => server.close())

    await helper.runInTransaction(t.nr.agent, function () {
      return new Promise((resolve) => {
        const { port } = server.address()
        // http does not add a host header to array headers, and the server
        // rejects requests without one
        const headers = [['host', `${HOSTNAME}:${port}`], ['x-foo', 'bar']]
        const opts = { host: HOSTNAME, port, path: '/', headers }
        http.request(opts, (res) => {
          res.resume()
          res.on('end', resolve)
        }).end()
      })
    })

    assert.equal(received['x-foo'], 'bar', 'should keep the existing headers')
    assert.ok(received.traceparent, 'should add traceparent')
  })
})

test('HttpClientSubscriber telemetry', async (t) => {
  // nock replaces `http.ClientRequest`, so use the real one against a local server
  t.before(async () => {
    nock.restore()
    const server = http.createServer((req, res) => {
      res.statusCode = req.url.startsWith('/missing') ? 404 : 200
      res.end('ok')
    })
    await new Promise((resolve) => server.listen(0, HOSTNAME, resolve))
    t.nr = { server, port: server.address().port }
  })

  t.after(() => {
    t.nr.server.close()
    nock.activate()
  })

  t.beforeEach((ctx) => {
    ctx.nr = { ...t.nr, agent: helper.instrumentMockedAgent() }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  /**
   * Makes a request to the local server and ends the transaction once the
   * response has been read.
   *
   * @param {object} params The function parameters.
   * @param {Transaction} params.transaction The active transaction.
   * @param {number} params.port The port of the local server.
   * @param {string} params.path The path to request.
   * @returns {Promise<http.IncomingMessage>} The response, once the transaction has ended.
   */
  function requestAndEnd({ transaction, port, path }) {
    return new Promise((resolve, reject) => {
      http.get({ host: HOSTNAME, port, path }, (res) => {
        res.resume()
        res.on('end', () => {
          transaction.end()
          resolve(res)
        })
      }).on('error', reject)
    })
  }

  /**
   * Finds the span event with the given name.
   *
   * @param {Agent} agent The agent that collected the spans.
   * @param {string} name The name of the span.
   * @returns {object} The span event.
   */
  function findSpan(agent, name) {
    const span = agent.spanEventAggregator.getEvents().find((s) => s.intrinsics.name === name)
    assert.ok(span, `should create a ${name} span`)
    return span
  }

  await t.test('should record external metrics for a web transaction', async (t) => {
    const { agent, port } = t.nr
    await helper.runInNamedTransaction(agent, (transaction) => requestAndEnd({ transaction, port, path: '/ok' }))

    const host = `${HOSTNAME}:${port}`
    assertExternalMetrics(agent, {
      unscoped: [`External/${host}/http`, `External/${host}/all`, 'External/allWeb', 'External/all'],
      scoped: { TestTransaction: [`External/${host}/http`] }
    })
  })

  await t.test('should record external metrics for a background transaction', async (t) => {
    const { agent, port } = t.nr
    await helper.runInNamedTransaction(agent, 'bg', (transaction) => requestAndEnd({ transaction, port, path: '/ok' }))

    const host = `${HOSTNAME}:${port}`
    assertExternalMetrics(agent, {
      unscoped: [`External/${host}/http`, `External/${host}/all`, 'External/allOther', 'External/all'],
      scoped: { TestTransaction: [`External/${host}/http`] }
    })
  })

  await t.test('should record the external segment attributes', async (t) => {
    const { agent, port } = t.nr
    let segment
    await helper.runInTransaction(agent, (transaction) => {
      const promise = requestAndEnd({ transaction, port, path: '/ok?a=b' })
      ;[segment] = getExternalSegments(transaction)
      return promise
    })

    assert.equal(segment.name, `External/${HOSTNAME}:${port}/ok`)
    assert.equal(segment.timer.isActive(), false, 'should end the segment')
    // the agent adds the exclusive duration to every segment when the transaction ends
    const { nr_exclusive_duration_millis: traceDuration, ...traceAttributes } = segment.getAttributes()
    const { nr_exclusive_duration_millis: spanDuration, ...spanAttributes } = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
    assert.equal(typeof traceDuration, 'number')
    assert.equal(typeof spanDuration, 'number')
    assert.deepStrictEqual(traceAttributes, {
      url: `http://${HOSTNAME}:${port}/ok`,
      procedure: 'GET'
    }, 'should add the url and method to the transaction trace segment')
    assert.deepStrictEqual(spanAttributes, {
      'request.parameters.a': 'b',
      hostname: HOSTNAME,
      port,
      url: `http://${HOSTNAME}:${port}/ok`,
      procedure: 'GET',
      'http.statusCode': 200,
      'http.statusText': 'OK'
    }, 'should add the request and response attributes for the span')
  })

  await t.test('should create an http client span event', async (t) => {
    const { agent, port } = t.nr
    let traceId
    await helper.runInTransaction(agent, (transaction) => {
      traceId = transaction.traceId
      return requestAndEnd({ transaction, port, path: '/ok?a=b' })
    })

    const span = findSpan(agent, `External/${HOSTNAME}:${port}/ok`)
    const { category, component, traceId: spanTraceId, 'span.kind': kind } = span.intrinsics
    assert.deepStrictEqual({ category, component, traceId: spanTraceId, kind }, {
      category: 'http',
      component: 'http',
      traceId,
      kind: 'client'
    })
    assert.deepStrictEqual({ ...getSpanAttributes(span) }, {
      'request.parameters.a': 'b',
      'server.address': HOSTNAME,
      'server.port': port,
      'http.url': `http://${HOSTNAME}:${port}/ok`,
      'http.method': 'GET',
      'http.request.method': 'GET',
      'http.statusCode': 200,
      'http.statusText': 'OK'
    })
  })

  await t.test('should record the status of an error response without capturing an error', async (t) => {
    const { agent, port } = t.nr
    await helper.runInTransaction(agent, (transaction) => requestAndEnd({ transaction, port, path: '/missing' }))

    const span = findSpan(agent, `External/${HOSTNAME}:${port}/missing`)
    const attributes = getSpanAttributes(span)
    assert.equal(attributes['http.statusCode'], 404)
    assert.equal(attributes['http.statusText'], 'Not Found')
    assert.ok(!('error.class' in attributes), 'should not add error attributes to the span')
    assert.equal(agent.errors.traceAggregator.errors.length, 0, 'should not collect an error')
    assertExternalMetrics(agent, {
      unscoped: [`External/${HOSTNAME}:${port}/http`, `External/${HOSTNAME}:${port}/all`, 'External/allWeb', 'External/all']
    })
  })

  await t.test('should run response listeners in the external segment', async (t) => {
    const { agent, port } = t.nr
    const segments = {}
    await helper.runInTransaction(agent, (transaction) => new Promise((resolve) => {
      http.get({ host: HOSTNAME, port, path: '/ok' }, (res) => {
        res.on('data', () => {
          segments.data = agent.tracer.getSegment()
        })
        res.on('end', () => {
          segments.end = agent.tracer.getSegment()
          segments.external = getExternalSegments(transaction)[0]
          resolve()
        })
      })
    }))

    assert.equal(segments.data, segments.external, 'should run data listeners in the external segment')
    assert.equal(segments.end, segments.external, 'should run end listeners in the external segment')
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

  await t.test('should record https requests', (t, end) => {
    const { agent } = t.nr
    nock('https://www.google.com').get('/index.html').reply(200)

    helper.runInTransaction(agent, function (transaction) {
      https.get('https://www.google.com/index.html', function (res) {
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.equal(child.name, 'External/www.google.com/index.html', 'should not add the default port to the name')
        assert.deepStrictEqual({ ...child.attributes.get(DESTINATIONS.SPAN_EVENT) }, {
          hostname: 'www.google.com',
          port: 443,
          url: 'https://www.google.com/index.html',
          procedure: 'GET',
          'http.statusCode': 200,
          'http.statusText': 'OK'
        })
        res.resume()
        res.on('end', () => {
          transaction.end()
          // https requests share the `http` library name
          assertExternalMetrics(agent, {
            unscoped: ['External/www.google.com/http', 'External/www.google.com/all', 'External/allWeb', 'External/all']
          })
          end()
        })
      })
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
        assert.equal(agent.metrics.getMetric(NAMES.EXTERNAL.ALL), undefined, 'should not record external metrics')
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
        const payload = JSON.parse(Buffer.from(headers.newrelic, 'base64').toString())
        assert.equal(payload.d.id, segment.id, 'newrelic header should reference the external segment')
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
