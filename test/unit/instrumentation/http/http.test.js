/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const DESTINATIONS = require('../../../../lib/config/attribute-filter').DESTINATIONS
const EventEmitter = require('events').EventEmitter
const helper = require('../../../lib/agent_helper')
const Shim = require('../../../../lib/shim').Shim
// TODO: check if i removed too many tests

test('built-in http module instrumentation', async (t) => {
  const PAYLOAD = JSON.stringify({ msg: 'ok' })

  const PAGE =
    '<html>' +
    '<head><title>test response</title></head>' +
    '<body><p>I heard you like HTML.</p></body>' +
    '</html>'

  await t.test('should not cause bootstrapping to fail', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.loadMockedAgent()
      ctx.nr.initialize = require('../../../../lib/instrumentation/core/http')
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
      process.env.FUNCTIONS_WORKER_RUNTIME = ''
    })

    await t.test('when passed no module', (t) => {
      const { agent, initialize } = t.nr
      assert.doesNotThrow(() => initialize(agent))
    })

    await t.test('when passed an empty module', (t) => {
      const { agent, initialize } = t.nr
      assert.doesNotThrow(() => initialize(agent, {}, 'http', new Shim(agent, 'http')))
    })

    await t.test('should not instrument if azure functions environment detected', (t) => {
      const { agent, initialize } = t.nr
      process.env.FUNCTIONS_WORKER_RUNTIME = 'node'
      const http = {
        request: function request(options) {
          const requested = new EventEmitter()
          requested.path = '/TEST'
          if (options.path) {
            requested.path = options.path
          }

          return requested
        }
      }
      assert.equal(initialize(agent, http, 'http', new Shim(agent, 'http')), false)
    })
  })

  await t.test('after loading', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.instrumentMockedAgent()
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test("should not have changed createServer's declared parameter names", () => {
      const fn = require('http').createServer
      /* Taken from
       * https://github.com/dhughes/CoolBeans/blob/master/lib/CoolBeans.js#L199
       */
      const params = fn
        .toString()
        .match(/function\s+\w*\s*\((.*?)\)/)[1]
        .split(/\s*,\s*/)
      assert.equal(params[0], 'requestListener')
    })
  })

  await t.test('with outbound request mocked', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      const agent = helper.loadMockedAgent()
      const initialize = require('../../../../lib/instrumentation/core/http')
      const http = {
        request: function request(options) {
          const requested = new EventEmitter()
          requested.path = '/TEST'
          if (options.path) {
            requested.path = options.path
          }

          return requested
        }
      }

      initialize(agent, http, 'http', new Shim(agent, 'http'))
      ctx.nr.agent = agent
      ctx.nr.http = http
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should not crash when called with undefined host', (t, end) => {
      const { agent, http } = t.nr
      helper.runInTransaction(agent, function () {
        assert.doesNotThrow(() => http.request({ port: 80 }))

        end()
      })
    })

    await t.test('should not crash when called with undefined port', (t, end) => {
      const { agent, http } = t.nr
      helper.runInTransaction(agent, function () {
        assert.doesNotThrow(() => http.request({ host: 'localhost' }))

        end()
      })
    })
  })

  await t.test('when running a request', async (t) => {
    t.beforeEach(async (ctx) => {
      ctx.nr = {}
      const agent = helper.instrumentMockedAgent()

      const http = require('http')
      agent.config.attributes.enabled = true

      const external = http.createServer(function (request, response) {
        response.writeHead(200, {
          'Content-Length': PAYLOAD.length,
          'Content-Type': 'application/json'
        })
        response.end(PAYLOAD)
      })

      const server = http.createServer(function (request, response) {
        ctx.nr.transaction = agent.getTransaction()
        assert.ok(ctx.nr.transaction, 'created transaction')

        if (/\/slow$/.test(request.url)) {
          setTimeout(function () {
            response.writeHead(200, {
              'Content-Length': PAGE.length,
              'Content-Type': 'text/html'
            })
            response.end(PAGE)
          }, 500)
          return
        }

        makeRequest(
          http,
          {
            port: ctx.nr.externalPort,
            host: 'localhost',
            path: '/status',
            method: 'GET'
          },
          function () {
            response.writeHead(200, {
              'Content-Length': PAGE.length,
              'Content-Type': 'text/html'
            })
            response.end(PAGE)
          }
        )
      })

      server.on('request', function () {
        ctx.nr.transaction2 = agent.getTransaction()
      })

      ctx.nr.agent = agent
      ctx.nr.http = http
      ctx.nr.external = external
      ctx.nr.server = server

      const ports = await new Promise((resolve) => {
        external.listen(0, 'localhost', function () {
          const { port: externalPort } = this.address()
          server.listen(0, 'localhost', function () {
            // The transaction doesn't get created until after the instrumented
            // server handler fires.
            assert.ok(!agent.getTransaction())
            const { port: serverPort } = this.address()
            resolve({ externalPort, serverPort })
          })
        })
      })
      ctx.nr.externalPort = ports.externalPort
      ctx.nr.serverPort = ports.serverPort
    })

    t.afterEach(async (ctx) => {
      const { agent, external, server } = ctx.nr
      await new Promise((resolve) => {
        external.close(() => {
          server.close(resolve)
        })
      })
      helper.unloadAgent(agent)
    })

    await t.test(
      'when allow_all_headers is false, only collect allowed agent-specified headers',
      (t, end) => {
        const { agent, http, serverPort } = t.nr
        agent.config.allow_all_headers = false
        makeRequest(
          http,
          {
            port: serverPort,
            host: 'localhost',
            path: '/path',
            method: 'GET',
            headers: {
              invalid: 'header',
              referer: 'valid-referer',
              'content-type': 'valid-type'
            }
          },
          finish
        )

        function finish() {
          const { transaction } = t.nr
          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          assert.ok(!attributes['request.headers.invalid'])
          assert.equal(attributes['request.headers.referer'], 'valid-referer')
          assert.equal(attributes['request.headers.contentType'], 'valid-type')
          end()
        }
      }
    )

    await t.test(
      'when allow_all_headers is true, collect all headers not filtered by `exclude` rules',
      (t, end) => {
        const { agent, http, serverPort } = t.nr
        agent.config.allow_all_headers = true
        agent.config.attributes.exclude = ['request.headers.x*']
        // have to emit attributes getting updated so all filters get updated
        agent.config.emit('attributes.exclude')
        makeRequest(
          http,
          {
            port: serverPort,
            host: 'localhost',
            path: '/path',
            method: 'GET',
            headers: {
              valid: 'header',
              referer: 'valid-referer',
              'content-type': 'valid-type',
              'X-filtered-out': 'invalid'
            }
          },
          finish
        )

        function finish() {
          const { transaction } = t.nr
          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          const segment = transaction.baseSegment
          const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          assert.ok(!attributes['request.headers.x-filtered-out'])
          assert.ok(!attributes['request.headers.xFilteredOut'])
          ;[attributes, spanAttributes].forEach((attrs) => {
            assert.equal(attrs['request.headers.valid'], 'header')
            assert.equal(attrs['request.headers.referer'], 'valid-referer')
            assert.equal(attrs['request.headers.contentType'], 'valid-type')
          })
          end()
        }
      }
    )

    await t.test(
      'when url_obfuscation regex pattern is set, obfuscate segment url attributes',
      (t, end) => {
        const { agent, http, serverPort } = t.nr
        agent.config.url_obfuscation = {
          enabled: true,
          regex: {
            pattern: '.*',
            replacement: '/***'
          }
        }
        makeRequest(
          http,
          {
            port: serverPort,
            host: 'localhost',
            path: '/foo4/bar4',
            method: 'GET'
          },
          finish
        )

        function finish() {
          const { transaction } = t.nr
          const segment = transaction.baseSegment
          const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          assert.equal(spanAttributes['request.uri'], '/***')

          end()
        }
      }
    )

    await t.test(
      'when url_obfuscation regex pattern is set, obfuscate transaction url',
      (t, end) => {
        const { agent, http, serverPort } = t.nr
        agent.config.url_obfuscation = {
          enabled: true,
          regex: {
            pattern: '.*',
            replacement: '/***'
          }
        }
        makeRequest(
          http,
          {
            port: serverPort,
            host: 'localhost',
            path: '/foo4/bar4',
            method: 'GET'
          },
          finish
        )

        function finish() {
          const { transaction } = t.nr
          assert.equal(transaction.url, '/***')

          end()
        }
      }
    )

    await t.test(
      'when url_obfuscation regex pattern is not set, url is only scrubbed',
      (t, end) => {
        const { agent, http, serverPort } = t.nr
        agent.config.url_obfuscation = { enabled: false }
        makeRequest(
          http,
          {
            port: serverPort,
            host: 'localhost',
            path: '/foo4/bar4?someParam=test',
            method: 'GET'
          },
          finish
        )

        function finish() {
          const { transaction } = t.nr
          assert.equal(transaction.url, '/foo4/bar4')

          end()
        }
      }
    )

    await t.test('request.uri should not contain request params', (t, end) => {
      const { http, serverPort } = t.nr
      makeRequest(
        http,
        {
          port: serverPort,
          host: 'localhost',
          path: '/foo5/bar5?region=here&auth=secretString',
          method: 'GET'
        },
        finish
      )

      function finish() {
        const { transaction } = t.nr
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

        assert.equal(spanAttributes['request.uri'], '/foo5/bar5')

        end()
      }
    })

    await t.test('successful request', (t, end) => {
      const { agent, http, externalPort, serverPort } = t.nr
      const refererUrl = 'https://www.google.com/search/cats?scrubbed=false'
      const userAgent = 'Palm680/RC1'

      makeRequest(
        http,
        {
          port: serverPort,
          host: 'localhost',
          path: '/path',
          method: 'GET',
          headers: {
            referer: refererUrl,
            'User-Agent': userAgent
          }
        },
        finish
      )

      function finish(err, statusCode, body) {
        assert.ifError(err)
        const { transaction, transaction2 } = t.nr
        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        const callStats = agent.metrics.getOrCreateMetric('WebTransaction/NormalizedUri/*')
        const dispatcherStats = agent.metrics.getOrCreateMetric('HttpDispatcher')
        const reqStats = transaction.metrics.getOrCreateMetric(
          `External/localhost:${externalPort}/http`,
          'WebTransaction/NormalizedUri/*'
        )

        assert.equal(statusCode, 200, 'response status code')
        assert.equal(body, PAGE, 'response body')
        ;[attributes, spanAttributes].forEach((attrs) => {
          assert.equal(
            attrs['request.headers.referer'],
            'https://www.google.com/search/cats',
            'headers.referer'
          )
          assert.equal(attrs['http.statusCode'], '200')
          assert.equal(attrs['http.statusText'], 'OK')
          assert.equal(attrs['request.headers.userAgent'], userAgent)
        })

        assert.equal(callStats.callCount, 2, 'records unscoped path stats after a normal request')
        assert.ok(
          dispatcherStats.callCount,
          2,
          'record unscoped HTTP dispatcher stats after a normal request'
        )
        assert.ok(
          agent.environment.get('Dispatcher').includes('http'),
          'http dispatcher is in play'
        )
        assert.equal(
          reqStats.callCount,
          1,
          'associates outbound HTTP requests with the inbound transaction'
        )
        assert.equal(transaction.port, serverPort, "set transaction.port to the server's port")
        assert.equal(transaction2.id, transaction.id, 'only create one transaction for the request')

        end()
      }
    })

    await t.test(
      'proxy url',
      (t, end) => {
        const { http, serverPort } = t.nr
        makeRequest(
          http,
          {
            port: serverPort,
            host: 'localhost',
            path: 'http://www.google.com/proxy/path',
            method: 'GET',
            headers: {}
          },
          finish
        )

        function finish() {
          const { transaction } = t.nr
          assert.equal(transaction.url, '/proxy/path')
          const segment = transaction.baseSegment
          const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          assert.equal(spanAttributes['request.uri'], '/proxy/path')

          end()
        }
      }
    )

    await t.test(
      'should default url to `/unknown` when it cannot be parsed',
      (t, end) => {
        const { http, serverPort } = t.nr
        makeRequest(
          http,
          {
            port: serverPort,
            host: 'localhost',
            path: 'http://///',
            method: 'GET',
            headers: {}
          },
          finish
        )

        function finish() {
          const { transaction } = t.nr
          assert.equal(transaction.url, '/unknown')
          const segment = transaction.baseSegment
          const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          assert.equal(spanAttributes['request.uri'], '/unknown')

          end()
        }
      }
    )
  })

  await t.test('Should accept w3c traceparent header when present on request', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.instrumentMockedAgent({
        distributed_tracing: {
          enabled: true
        },
        feature_flag: {}
      })
      ctx.nr.http = require('http')
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should set header correctly when all data is present', (t, end) => {
      const { agent, http } = t.nr
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const priority = 0.789
      // eslint-disable-next-line
      const tracestate = `190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-${priority}-1563574856827`;
      agent.config.trusted_account_key = 190

      const server = http.createServer(function (req, res) {
        const txn = agent.getTransaction()

        const outboundHeaders = createHeadersAndInsertTrace(txn)

        assert.equal(outboundHeaders.traceparent.startsWith('00-4bf92f3577b'), true)
        assert.equal(txn.priority, priority)
        res.writeHead(200, { 'Content-Length': 3 })
        res.end('hi!')
      })

      const headers = {
        traceparent,
        tracestate
      }

      server.on('listening', function () {
        const port = server.address().port
        http.get({ host: 'localhost', port, headers }, function (res) {
          res.resume()
          server.close(end)
        })
      })

      helper.startServerWithRandomPortRetry(server)
    })

    await t.test('should set traceparent header correctly tracestate missing', (t, end) => {
      const { agent, http } = t.nr
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      agent.config.trusted_account_key = 190

      const server = http.createServer(function (req, res) {
        const txn = agent.getTransaction()

        const outboundHeaders = createHeadersAndInsertTrace(txn)

        assert.ok(outboundHeaders.traceparent.startsWith('00-4bf92f3577b'))
        res.writeHead(200, { 'Content-Length': 3 })
        res.end('hi!')
      })

      const headers = {
        traceparent
      }

      server.on('listening', function () {
        const port = server.address().port
        http.get({ host: 'localhost', port, headers }, function (res) {
          res.resume()
          server.close(end)
        })
      })

      helper.startServerWithRandomPortRetry(server)
    })

    await t.test('should set traceparent header correctly tracestate empty string', (t, end) => {
      const { agent, http } = t.nr
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      const tracestate = ''
      agent.config.trusted_account_key = 190

      const server = http.createServer(function (req, res) {
        const txn = agent.getTransaction()
        const outboundHeaders = createHeadersAndInsertTrace(txn)
        assert.equal(outboundHeaders.traceparent.startsWith('00-4bf92f3577b'), true)

        res.writeHead(200, { 'Content-Length': 3 })
        res.end('hi!')
      })

      const headers = {
        traceparent,
        tracestate
      }

      server.on('listening', function () {
        const port = server.address().port
        http.get({ host: 'localhost', port, headers }, function (res) {
          res.resume()
          server.close(end)
        })
      })

      helper.startServerWithRandomPortRetry(server)
    })
  })
})

test('http.createServer should trace errors in top-level handlers', () => {
  helper.execSync({ cwd: __dirname, script: './fixtures/http-create-server-uncaught-exception.js' })
})

test('http.request should trace errors in listeners', () => {
  helper.execSync({ cwd: __dirname, script: './fixtures/http-request-uncaught-exception.js' })
})

function createHeadersAndInsertTrace(transaction) {
  const headers = {}
  transaction.insertDistributedTraceHeaders(headers)

  return headers
}

function makeRequest(http, params, cb) {
  const req = http.request(params, function (res) {
    if (res.statusCode !== 200) {
      return cb(null, res.statusCode, null)
    }

    res.setEncoding('utf8')
    res.on('data', function (data) {
      cb(null, res.statusCode, data)
    })
  })

  req.on('error', function (err) {
    // If we aborted the request and the error is a connection reset, then
    // all is well with the world. Otherwise, ERROR!
    if (params.abort && err.code === 'ECONNRESET') {
      cb()
    } else {
      cb(err)
    }
  })

  if (params.abort) {
    setTimeout(function () {
      req.abort()
    }, params.abort)
  }
  req.end()
}
