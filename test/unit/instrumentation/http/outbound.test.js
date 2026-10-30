/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const http = require('node:http')
const net = require('node:net')
const url = require('node:url')
const nock = require('nock')

const Tracestate = require('#agentlib/w3c/tracestate.js')
const helper = require('../../../lib/agent_helper')
const HttpOutboundSubscriber = require('#agentlib/subscribers/core/http-outbound.js')
const logger = require('#agentlib/logger.js')
const symbols = require('../../../../lib/symbols')
const testSignatures = require('./outbound-utils')

const { DESTINATIONS } = require('../../../../lib/config/attribute-filter')
const NAMES = require('../../../../lib/metrics/names')
const HOSTNAME = 'localhost'
const PORT = 8890

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

test('HttpOutboundSubscriber', async (t) => {
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
      end()
    })
  })

  await t.test('should not record requests outside of a transaction', () => {
    const req = makeRequest({ host: HOSTNAME, port: PORT, path: '/newrelic' })

    assert.ok(!req.getHeader('traceparent'), 'should not add tracing headers')
    assert.ok(!req[symbols.segment])
  })

  await t.test('should tie the request to the external segment', (t, end) => {
    helper.runInTransaction(t.nr.agent, function (transaction) {
      const req = makeRequest({ host: HOSTNAME, port: PORT, path: '/newrelic' })

      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(req[symbols.segment], child)
      assert.equal(child.name, `${NAMES.EXTERNAL.PREFIX}${HOSTNAME}:${PORT}/newrelic`)
      end()
    })
  })

  await t.test('should keep the port and credentials of a url string', (t, end) => {
    helper.runInTransaction(t.nr.agent, function (transaction) {
      const req = http.request(`http://user:pass@${HOSTNAME}:${PORT}/newrelic?a=b`)
      req.on('error', () => {})

      const [child] = getExternalSegments(transaction)
      assert.equal(child.name, `${NAMES.EXTERNAL.PREFIX}${HOSTNAME}:${PORT}/newrelic`)
      assert.equal(child.attributes.get(DESTINATIONS.SPAN_EVENT).port, PORT)
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
      assert.equal(child.attributes.get(DESTINATIONS.SPAN_EVENT).hostname, '::1')
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
        const attributes = child.attributes.get(DESTINATIONS.SPAN_EVENT)
        assert.equal(attributes.url, url)
        assert.equal(attributes.hostname, 'example.com')
        assert.equal(attributes.port, port)
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

test('HttpOutboundSubscriber enabled', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    ctx.nr = { agent, subscriber: new HttpOutboundSubscriber({ agent, logger }) }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should be enabled when only https instrumentation is enabled', (t) => {
    const { agent, subscriber } = t.nr
    agent.config.instrumentation.http.enabled = false
    assert.equal(subscriber.enabled, true)
  })

  await t.test('should be enabled when only http instrumentation is enabled', (t) => {
    const { agent, subscriber } = t.nr
    agent.config.instrumentation.https.enabled = false
    assert.equal(subscriber.enabled, true)
  })

  await t.test('should be disabled when http and https instrumentation are disabled', (t) => {
    const { agent, subscriber } = t.nr
    agent.config.instrumentation.http.enabled = false
    agent.config.instrumentation.https.enabled = false
    assert.equal(subscriber.enabled, false)
  })
})

test('HttpOutboundSubscriber instrument', async (t) => {
  /**
   * Builds a stand-in for the `http` or `https` module.
   *
   * @returns {object} An object with `request` and `get` methods.
   */
  function fakeModule() {
    return { request() {}, get() {} }
  }

  /**
   * Checks whether the module's request methods were wrapped.
   *
   * @param {object} mod The module to inspect.
   * @returns {boolean} `true` when both `request` and `get` are wrapped.
   */
  function isWrapped(mod) {
    return typeof mod.request[symbols.unwrap] === 'function' && typeof mod.get[symbols.unwrap] === 'function'
  }

  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    const modules = { http: fakeModule(), https: fakeModule() }
    ctx.nr = { agent, modules, subscriber: new HttpOutboundSubscriber({ agent, logger }) }
  })

  t.afterEach((ctx) => {
    delete process.env.FUNCTIONS_WORKER_RUNTIME
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should wrap request and get on http and https', (t) => {
    const { modules, subscriber } = t.nr
    subscriber.instrument(modules)
    assert.equal(isWrapped(modules.http), true)
    assert.equal(isWrapped(modules.https), true)
  })

  await t.test('should only wrap https when http instrumentation is disabled', (t) => {
    const { agent, modules, subscriber } = t.nr
    agent.config.instrumentation.http.enabled = false
    subscriber.instrument(modules)
    assert.equal(isWrapped(modules.http), false)
    assert.equal(isWrapped(modules.https), true)
  })

  await t.test('should only wrap http when https instrumentation is disabled', (t) => {
    const { agent, modules, subscriber } = t.nr
    agent.config.instrumentation.https.enabled = false
    subscriber.instrument(modules)
    assert.equal(isWrapped(modules.http), true)
    assert.equal(isWrapped(modules.https), false)
  })

  await t.test('should not wrap anything in an azure functions environment', (t) => {
    const { modules, subscriber } = t.nr
    process.env.FUNCTIONS_WORKER_RUNTIME = 'node'
    subscriber.instrument(modules)
    assert.equal(isWrapped(modules.http), false)
    assert.equal(isWrapped(modules.https), false)
  })

  await t.test('should resolve the http and https modules', (t) => {
    const { subscriber } = t.nr
    assert.deepEqual(subscriber.resolveModule(), { http, https: require('node:https') })
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
