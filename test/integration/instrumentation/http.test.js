/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const assert = require('node:assert')
const http = require('http')
const helper = require('../../lib/agent_helper')
const StreamSink = require('../../../lib/util/stream-sink')
const HTTP_ATTRS = require('../../lib/fixtures').httpAttributes
const tempRemoveListeners = require('../../lib/temp-remove-listeners')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent()
  ctx.nr = {
    agent
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('built-in http instrumentation should handle internal & external requests', function (t, end) {
  const { agent } = t.nr
  agent.config.attributes.enabled = true

  const TEST_INTERNAL_PORT = 8123
  const TEST_INTERNAL_PATH = '/path'
  const TEST_EXTERNAL_PORT = 8321
  const TEST_EXTERNAL_PATH = '/status'
  const TEST_HOST = 'localhost'
  const PAYLOAD = JSON.stringify({ msg: 'ok' })
  const PAGE =
    '<html>' +
    '<head><title>test response</title></head>' +
    '<body><p>I heard you like HTML.</p></body>' +
    '</html>'

  const external = http.createServer((request, response) => {
    response.writeHead(200, {
      'Content-Length': PAYLOAD.length,
      'Content-Type': 'application/json'
    })
    response.end(PAYLOAD)
  })

  // save for later use in the test response handler
  let transaction
  const internalResponseHandler = function (response) {
    return function (requestResponse) {
      transaction = agent.getTransaction()
      assert.ok(transaction, 'handler is part of transaction')

      if (requestResponse.statusCode !== 200) {
        return assert.fail(requestResponse.statusCode)
      }

      requestResponse.setEncoding('utf8')
      requestResponse.on('data', function (data) {
        assert.equal(data, PAYLOAD, "response handler shouldn't alter payload")
      })

      response.writeHead(200, {
        'Content-Length': PAGE.length,
        'Content-Type': 'text/html'
      })
      response.end(PAGE)
    }
  }

  const server = http.createServer((request, response) => {
    assert.ok(agent.getTransaction(), 'should be within the scope of the transaction')

    const req = http.request(
      {
        host: TEST_HOST,
        port: TEST_EXTERNAL_PORT,
        path: TEST_EXTERNAL_PATH,
        method: 'GET'
      },
      internalResponseHandler(response)
    )

    req.on('error', function (error) {
      assert.ok(!error)
    })

    req.end()
  })

  t.after(() => {
    external.close()
    server.close()
  })

  const testResponseHandler = function (response) {
    assert.equal(response.statusCode, 200, 'should return 200')
    response.setEncoding('utf8')

    let fetchedBody = ''
    response.on('data', function (data) {
      fetchedBody += data
    })

    // this is where execution ends up -- test asserts go here
    response.on('end', function () {
      assert.ok(transaction, 'should have transaction')
      assert.equal(response.statusCode, 200, 'should successfully fetch the page')
      assert.equal(fetchedBody, PAGE, "page shouldn't change")

      const scope = 'WebTransaction/NormalizedUri/*'
      let stats = agent.metrics.getOrCreateMetric(scope)

      assert.equal(transaction.type, 'web', 'should be a web transaction')
      assert.equal(transaction.name, scope, 'should set transaction name')
      assert.equal(
        transaction.name,
        transaction.baseSegment.name,
        'baseSegment name should match transaction name'
      )

      assert.equal(stats.callCount, 2, 'should record unscoped path stats after a normal request')

      const isDispatcher = agent.environment.get('Dispatcher').indexOf('http') > -1
      assert.ok(isDispatcher, 'should indicate that the http dispatcher is in play')

      stats = agent.metrics.getOrCreateMetric('HttpDispatcher')
      assert.equal(stats.callCount, 2, 'should have accounted for all the internal http requests')

      stats = agent.metrics.getOrCreateMetric('External/localhost:8321/http', scope)
      assert.equal(stats.callCount, 1, 'should record outbound HTTP requests in metrics')

      stats = transaction.metrics.getOrCreateMetric('External/localhost:8321/http', scope)
      assert.equal(
        stats.callCount,
        1,
        'should associate outbound HTTP requests with the inbound transaction'
      )

      stats = transaction.metrics.getOrCreateMetric('External/localhost:8321/all')
      assert.equal(stats.callCount, 1, 'should record unscoped outbound HTTP requests in metrics')

      stats = transaction.metrics.getOrCreateMetric('External/allWeb')
      assert.equal(stats.callCount, 1, 'should record unscoped outbound HTTP requests in metrics')

      stats = transaction.metrics.getOrCreateMetric('External/all')
      assert.equal(stats.callCount, 1, 'should record unscoped outbound HTTP requests in metrics')

      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)

      HTTP_ATTRS.forEach(function (key) {
        assert.ok(attributes[key] !== undefined, 'Trace contains attribute: ' + key)
      })
      if (attributes.httpResponseMessage) {
        assert.equal(attributes.httpResponseMessage, 'OK', 'Trace contains httpResponseMessage')
      }

      end()
    })
  }

  external.listen(TEST_EXTERNAL_PORT, TEST_HOST, function () {
    server.listen(TEST_INTERNAL_PORT, TEST_HOST, function () {
      // The transaction doesn't get created until after the instrumented
      // server handler fires.
      assert.ok(!agent.getTransaction(), 'should create tx until first request')

      const req = http.request(
        {
          host: TEST_HOST,
          port: TEST_INTERNAL_PORT,
          path: TEST_INTERNAL_PATH,
          method: 'GET'
        },
        testResponseHandler
      )

      req.on('error', function (error) {
        assert.fail(error)
      })

      req.end()
    })
  })
})

test('built-in http instrumentation should not swallow errors', async function (t) {
  const { agent } = t.nr
  tempRemoveListeners({ t, emitter: process, event: 'uncaughtException' })
  const plan = tspl(t, { plan: 8 })
  let server = null
  t.after(() => {
    server.close()
  })

  const pin = setTimeout(function () {}, 1000)
  helper.runOutOfContext(function () {
    clearTimeout(pin)

    server = http.createServer(handleRequest)
    server.listen(1337, makeRequest)
  })

  function handleRequest(req, res) {
    process.once('uncaughtException', function (error) {
      plan.ok(error, 'got error in uncaughtException handler.')
      res.statusCode = 501

      res.end()
    })

    // this is gonna blow up
    // eslint-disable-next-line no-use-before-define, sonarjs/no-dead-store
    const x = x.dieshere.ohno
  }

  function makeRequest() {
    const options = {
      host: 'localhost',
      port: 1337,
      path: '/'
    }

    http.get(options, function (res) {
      plan.equal(res.statusCode, 501, 'should get expected (error) status code')

      const errors = agent.errors.traceAggregator.errors
      plan.ok(errors, 'should find error')
      plan.equal(errors.length, 2, 'should be 2 errors')

      const first = errors[0]
      const second = errors[1]
      plan.ok(first, 'should have the first error')

      plan.equal(
        first[2],
        "Cannot access 'x' before initialization",
        'should get the expected error'
      )

      plan.ok(second, 'should have the second error')
      plan.equal(second[2], 'HttpError 501', 'should get the expected error')
    })
  }
  await plan.completed
})

test('built-in http instrumentation making outbound requests', function (t, end) {
  const { agent } = t.nr
  const server = http.createServer((req, res) => {
    const body = '{"status":"ok"}'
    res.writeHead(200, {
      'Content-Length': body.length,
      'Content-Type': 'text/plain'
    })
    res.end(body)
  })

  t.after(() => {
    server.close()
  })

  function request(type, options, next) {
    http
      .request(options, function (res) {
        assert.equal(res.statusCode, 200, 'got HTTP OK status code')

        const sink = new StreamSink(function (err, body) {
          assert.ok(!err, 'should not error')
          assert.deepEqual(
            JSON.parse(body),
            { status: 'ok' },
            'request with ' + type + ' defined succeeded'
          )
          next()
        })
        res.pipe(sink)
      })
      .end()
  }

  function requestWithHost(next) {
    request(
      'options.host',
      {
        host: 'localhost',
        port: 1337,
        path: '/',
        agent: false
      },
      next
    )
  }

  function requestWithHostname(next) {
    request(
      'options.hostname',
      {
        hostname: 'localhost',
        port: 1337,
        path: '/',
        agent: false
      },
      next
    )
  }

  function requestWithNOTHING(next) {
    request(
      'nothing',
      {
        port: 1337,
        path: '/',
        agent: false
      },
      next
    )
  }

  server.listen(1337, function () {
    helper.runInTransaction(agent, function () {
      requestWithHost(function () {
        requestWithHostname(function () {
          requestWithNOTHING(function () {
            end()
          })
        })
      })
    })
  })
})

test(
  'built-in http instrumentation should not crash for requests that are in progress' +
    ' when the server is closed',
  async function (t) {
    const plan = tspl(t, { plan: 5 })

    let count = 0
    let closing = false
    const server = http.createServer(function (req, res) {
      count++

      if (count === 1) {
        setTimeout(() => {
          plan.ok(1, 'request #1 was received')
          res.end()

          closing = true
          this.close()
        }, 5)
      } else {
        setTimeout(function () {
          plan.ok(1, 'request #2 was received')
          plan.ok(closing, 'server should be closing when request #2 is handled')
          res.end()
        }, 10)
      }
    })

    server.listen(0, function () {
      // make two quick requests
      makeRequest(function () {
        plan.ok(1, 'request #1 got response')
      })

      makeRequest(function () {
        plan.ok(1, 'request #2 got response')
      })
    })

    function makeRequest(callback) {
      const options = {
        hostname: 'localhost',
        port: server.address().port,
        path: '/',
        agent: false
      }
      const req = http.request(options, callback)
      req.on('error', function (err) {
        plan.ok(!err, 'should not fail to make requests')
      })
      req.end()
    }

    await plan.completed
  }
)

// NODE-999
test('built-in http instrumentation should not crash when server does not have address', async function (t) {
  const plan = tspl(t, { plan: 3 })

  const server = http.createServer(function (req, res) {
    res.end()
  })
  t.after(() => {
    server.close()
  })

  let port
  server.listen(0, function () {
    port = server.address().port
    plan.ok(server.address, 'has address')

    // remove address function
    server.address = null
    plan.ok(!server.address, 'should not have address')

    makeRequest(function () {
      plan.ok(true, 'request #1 got response')
    })
  })

  function makeRequest(callback) {
    const options = {
      hostname: 'localhost',
      port,
      path: '/',
      agent: false
    }
    http.request(options, callback).end()
  }

  await plan.completed
})
