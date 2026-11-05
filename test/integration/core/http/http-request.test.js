/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const http = require('node:http')
const helper = require('#testlib/agent_helper.js')

test('when running a request', async (t) => {
  const PAYLOAD = JSON.stringify({ msg: 'ok' })
  const PAGE =
    '<html>' +
    '<head><title>test response</title></head>' +
    '<body><p>I heard you like HTML.</p></body>' +
    '</html>'

  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const agent = helper.instrumentMockedAgent()

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
          // Headers are set individually (rather than passed inline to
          // writeHead) so `response.getHeaders()` -- and thus
          // `response.headers.*` attribute collection -- still reflects
          // them once the response finishes; headers passed inline to
          // writeHead bypass that internal map. See parity note on the
          // 'successful request' test below.
          response.setHeader('Content-Length', PAGE.length)
          response.setHeader('Content-Type', 'text/html')
          response.writeHead(200)
          response.end(PAGE)
        }
      )
    })

    server.on('request', function () {
      ctx.nr.transaction2 = agent.getTransaction()
    })

    ctx.nr.agent = agent
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
      const { agent, serverPort } = t.nr
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
      const { agent, serverPort } = t.nr
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
      const { agent, serverPort } = t.nr
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
      const { agent, serverPort } = t.nr
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
      const { agent, serverPort } = t.nr
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
    const { serverPort } = t.nr
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

  // this is a test of both client and server, keeping it in here for now
  await t.test('successful request', (t, end) => {
    const { agent, externalPort, serverPort } = t.nr
    const refererUrl = 'https://www.google.com/search/cats?scrubbed=false'
    const userAgent = 'Palm680/RC1'
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

    agent.config.attributes.include = ['request.parameters.*']
    agent.config.emit('attributes.include')

    makeRequest(
      http,
      {
        port: serverPort,
        host: 'localhost',
        path: '/path?foo=bar',
        method: 'GET',
        headers: {
          referer: refererUrl,
          'User-Agent': userAgent,
          traceparent
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
        // Response headers are only captured when set via `setHeader`
        // (see the server's setup above) -- headers passed inline to
        // `writeHead` bypass `response.getHeaders()`
        assert.equal(attrs['response.headers.contentType'], 'text/html', 'response.headers.contentType')
        assert.equal(
          attrs['response.headers.contentLength'],
          String(PAGE.length),
          'response.headers.contentLength'
        )
        assert.equal(attrs['request.parameters.foo'], 'bar', 'request.parameters.foo')
      })

      assert.equal(transaction.verb, 'GET', 'should set transaction.verb from the request method')

      assert.ok(
        segment.getDurationInMillis() > 0,
        'base segment should have a nonzero duration once the response ends'
      )

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
      assert.equal(
        transaction.parentTransportType,
        'HTTP',
        'should record the HTTP transport from the accepted traceparent'
      )

      end()
    }
  })

  await t.test('proxy url', (t, end) => {
    const { serverPort } = t.nr
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
  })

  await t.test('should default url to `/unknown` when it cannot be parsed', (t, end) => {
    const { serverPort } = t.nr
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
  })
})

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
