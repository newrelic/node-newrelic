/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const http = require('http')
const https = require('https')
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

tap.test('instrumentOutbound', (t) => {
  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should omit query parameters from path if attributes.enabled is false', (t) => {
    helper.unloadAgent(agent)
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: false
      }
    })
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      t.same(transaction.trace.root.children[0].getAttributes(), {})

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
    })
    t.end()
  })

  t.test('should omit query parameters from path if high_security is true', (t) => {
    helper.unloadAgent(agent)
    agent = helper.loadMockedAgent({
      high_security: true
    })
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      t.same(transaction.trace.root.children[0].getAttributes(), {
        procedure: 'GET',
        url: `http://${HOSTNAME}:${PORT}/asdf`
      })

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
    })
    t.end()
  })

  t.test('should obfuscate url path if url_obfuscation regex pattern is set', (t) => {
    helper.unloadAgent(agent)
    agent = helper.loadMockedAgent({
      url_obfuscation: {
        enabled: true,
        regex: {
          pattern: '.*',
          replacement: '/***'
        }
      }
    })
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      t.same(transaction.trace.root.children[0].getAttributes(), {
        procedure: 'GET',
        url: `http://${HOSTNAME}:${PORT}/***`
      })

      function makeFakeRequest() {
        req.path = '/asdf/foo/bar/baz?test=123&test2=456'
        return req
      }
    })
    t.end()
  })

  t.test('should strip query parameters from path in transaction trace segment', (t) => {
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      const path = '/asdf'
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path

      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      t.equal(transaction.trace.root.children[0].name, name)

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
    })
    t.end()
  })

  t.test('should save query parameters from path if attributes.enabled is true', (t) => {
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      agent.config.attributes.enabled = true
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      t.same(
        transaction.trace.root.children[0].attributes.get(DESTINATIONS.SPAN_EVENT),
        {
          'host': HOSTNAME,
          'port': PORT,
          'url': `http://${HOSTNAME}:${PORT}/asdf`,
          'procedure': 'GET',
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
    })
    t.end()
  })

  t.test('should not accept an undefined path', (t) => {
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      t.throws(
        () => instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest),
        Error
      )
    })

    function makeFakeRequest() {
      return req
    }
    t.end()
  })

  t.test('should accept a simple path with no parameters', (t) => {
    const req = new events.EventEmitter()
    const path = '/newrelic'
    helper.runInTransaction(agent, function (transaction) {
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path
      req.path = path
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      t.equal(transaction.trace.root.children[0].name, name)
    })

    function makeFakeRequest() {
      req.path = path
      return req
    }
    t.end()
  })

  t.test('should purge trailing slash', (t) => {
    const req = new events.EventEmitter()
    const path = '/newrelic/'
    helper.runInTransaction(agent, function (transaction) {
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + '/newrelic'
      req.path = path
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      t.equal(transaction.trace.root.children[0].name, name)
    })

    function makeFakeRequest() {
      req.path = path
      return req
    }
    t.end()
  })

  t.test('should not throw if hostname is undefined', (t) => {
    const req = new events.EventEmitter()

    helper.runInTransaction(agent, function () {
      let req2 = null
      t.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { port: PORT }, makeFakeRequest)
      })

      t.equal(req2, req)
      t.notOk(req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    t.end()
  })

  t.test('should not throw if hostname is null', (t) => {
    const req = new events.EventEmitter()

    helper.runInTransaction(agent, function () {
      let req2 = null
      t.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { host: null, port: PORT }, makeFakeRequest)
      })

      t.equal(req2, req)
      t.notOk(req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    t.end()
  })

  t.test('should not throw if hostname is an empty string', (t) => {
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      let req2 = null
      t.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { host: '', port: PORT }, makeFakeRequest)
      })

      t.equal(req2, req)
      t.notOk(req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    t.end()
  })

  t.test('should not throw if port is undefined', (t) => {
    const req = new events.EventEmitter()

    helper.runInTransaction(agent, function () {
      let req2 = null
      t.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { host: 'hostname' }, makeFakeRequest)
      })

      t.equal(req2, req)
      t.notOk(req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    t.end()
  })

  t.test('should not crash when req.headers is null', (t) => {
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      const path = '/asdf'

      instrumentOutbound(agent, { headers: null, host: HOSTNAME, port: PORT }, makeFakeRequest)

      function makeFakeRequest(opts) {
        t.ok(opts.headers, 'should assign headers when null')
        t.ok(opts.headers.traceparent, 'traceparent should exist')
        req.path = path
        return req
      }
    })
    t.end()
  })

  t.end()
})

tap.test('should add data from cat header to segment', (t) => {
  const encKey = 'gringletoes'
  let server
  let agent

  const appData = ['123#456', 'abc', 0, 0, -1, 'xyz']

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({
      cross_application_tracer: { enabled: true },
      distributed_tracing: { enabled: false },
      encoding_key: encKey,
      trusted_account_ids: [123]
    })
    const obfData = hashes.obfuscateNameUsingKey(JSON.stringify(appData), encKey)
    server = http.createServer(function (req, res) {
      res.writeHead(200, { 'x-newrelic-app-data': obfData })
      res.end()
      req.resume()
    })

    return new Promise((resolve) => {
      helper.randomPort((port) => {
        server.listen(port, resolve)
      })
    })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    return new Promise((resolve) => {
      server.close(resolve)
    })
  })

  function addSegment() {
    const transaction = agent.getTransaction()
    transaction.type = 'web'
    transaction.baseSegment = new Segment(transaction, 'base-segment')
  }

  t.test('should use config.obfuscatedId as the x-newrelic-id header', (t) => {
    helper.runInTransaction(agent, function () {
      addSegment()

      const port = server.address().port
      http
        .get({ host: 'localhost', port: port }, function (res) {
          const segment = agent.tracer.getTransaction().trace.root.children[0]

          t.match(segment, {
            catId: '123#456',
            catTransaction: 'abc'
          })

          t.equal(segment.name, `ExternalTransaction/localhost:${port}/123#456/abc`)
          t.equal(segment.getAttributes().transaction_guid, 'xyz')
          res.resume()
          agent.getTransaction().end()
          t.end()
        })
        .end()
    })
  })

  t.test('should not explode with invalid data', (t) => {
    helper.runInTransaction(agent, function () {
      addSegment()

      const port = server.address().port
      http
        .get({ host: 'localhost', port: port }, function (res) {
          const segment = agent.tracer.getTransaction().trace.root.children[0]

          t.match(segment, {
            catId: '123#456',
            catTransaction: 'abc'
          })

          // TODO: port in metric is a known bug. issue #142
          t.equal(segment.name, `ExternalTransaction/localhost:${port}/123#456/abc`)
          t.equal(segment.getAttributes().transaction_guid, 'xyz')
          res.resume()
          agent.getTransaction().end()
          t.end()
        })
        .end()
    })
  })

  t.test('should collect errors only if they are not being handled', (t) => {
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
        t.equal(transaction.exceptions.length, 0)
        unhandled(transaction)
      })

      req.on('error', function (err) {
        t.equal(err.code, expectedCode)
      })

      req.end()
    }

    function unhandled(transaction) {
      const req = http.get({ host: 'localhost', port: 12345 }, function () {})

      req.on('close', function () {
        t.equal(transaction.exceptions.length, 1)
        t.equal(transaction.exceptions[0].error.code, expectedCode)
        t.end()
      })

      req.end()
    }
  })

  t.end()
})

tap.test('when working with http.request', (t) => {
  let agent = null
  let contextManager = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()
    contextManager = helper.getContextManager()

    nock.disableNetConnect()
  })

  t.afterEach(() => {
    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  t.test('should accept port and hostname', (t) => {
    const host = 'http://www.google.com'
    const path = '/index.html'
    nock(host).get(path).reply(200, 'Hello from Google')

    helper.runInTransaction(agent, function (transaction) {
      http.get('http://www.google.com/index.html', function (res) {
        const segment = contextManager.getContext()

        t.equal(segment.name, 'External/www.google.com/index.html')
        res.resume()
        transaction.end()
        t.end()
      })
    })
  })

  t.test('should conform to external segment spec', (t) => {
    const host = 'http://www.google.com'
    const path = '/index.html'
    nock(host).post(path).reply(200)

    helper.runInTransaction(agent, function (transaction) {
      const opts = url.parse(`${host}${path}`)
      opts.method = 'POST'

      const req = http.request(opts, function (res) {
        const attributes = transaction.trace.root.children[0].getAttributes()
        t.equal(attributes.url, 'http://www.google.com/index.html')
        t.equal(attributes.procedure, 'POST')
        res.resume()
        transaction.end()
        t.end()
      })
      req.end()
    })
  })

  t.test('should start and end segment', (t) => {
    const host = 'http://www.google.com'
    const path = '/index.html'
    nock(host).get(path).delay(10).reply(200, 'Hello from Google')

    helper.runInTransaction(agent, function (transaction) {
      http.get('http://www.google.com/index.html', function (res) {
        const segment = contextManager.getContext()

        t.ok(segment.timer.hrstart instanceof Array)
        t.equal(segment.timer.hrDuration, null)

        res.resume()
        res.on('end', function onEnd() {
          t.ok(segment.timer.hrDuration instanceof Array)
          t.ok(segment.timer.getDurationInMillis() > 0)
          transaction.end()
          t.end()
        })
      })
    })
  })

  t.test('should not modify parent segment when parent segment opaque', (t) => {
    const host = 'http://www.google.com'
    const paramName = 'testParam'
    const path = `/index.html?${paramName}=value`

    nock(host).get(path).reply(200, 'Hello from Google')

    helper.runInTransaction(agent, (transaction) => {
      const parentSegment = agent.tracer.createSegment('ParentSegment')
      parentSegment.opaque = true

      contextManager.setContext(parentSegment) // make the current active segment

      http.get(`${host}${path}`, (res) => {
        const segment = contextManager.getContext()

        t.equal(segment, parentSegment)
        t.equal(segment.name, 'ParentSegment')

        const attributes = segment.getAttributes()

        t.notOk(attributes.url)

        t.notOk(attributes[`request.parameters.${paramName}`])

        res.resume()
        transaction.end()
        t.end()
      })
    })
  })

  t.test('generates dt and w3c trace context headers to outbound request', (t) => {
    helper.unloadAgent(agent)
    agent = helper.instrumentMockedAgent({
      distributed_tracing: {
        enabled: true
      },
      feature_flag: {}
    })
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
        t.ok(headers.traceparent, 'traceparent header')
        t.equal(headers.traceparent.split('-').length, 4)
        t.ok(headers.tracestate, 'tracestate header')
        t.notOk(headers.tracestate.includes('null'))
        t.notOk(headers.tracestate.includes('true'))

        t.ok(headers.newrelic, 'dt headers')
      })

    helper.runInTransaction(agent, (transaction) => {
      http.get(`${host}${path}`, (res) => {
        res.resume()
        transaction.end()
        const tc = transaction.traceContext
        const valid = tc._validateAndParseTraceStateHeader(headers.tracestate)
        t.ok(valid.entryValid)
        t.end()
      })
    })
  })

  t.test('should only add w3c header when exclude_newrelic_header: true', (t) => {
    helper.unloadAgent(agent)
    agent = helper.instrumentMockedAgent({
      distributed_tracing: {
        enabled: true,
        exclude_newrelic_header: true
      },
      feature_flag: {}
    })
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
        t.ok(headers.traceparent)
        t.equal(headers.traceparent.split('-').length, 4)
        t.ok(headers.tracestate)
        t.notOk(headers.tracestate.includes('null'))
        t.notOk(headers.tracestate.includes('true'))

        t.notOk(headers.newrelic)
      })

    helper.runInTransaction(agent, (transaction) => {
      http.get(`${host}${path}`, (res) => {
        res.resume()
        transaction.end()
        const tc = transaction.traceContext
        const valid = tc._validateAndParseTraceStateHeader(headers.tracestate)
        t.equal(valid.entryValid, true)
        t.end()
      })
    })
  })

  t.end()
})

tap.test('Should properly handle http(s) get and request signatures', (t) => {
  t.autoend()

  let agent = null
  let contextManager = null

  function beforeTest() {
    agent = helper.instrumentMockedAgent()
    contextManager = helper.getContextManager()

    nock.disableNetConnect()
  }

  function afterTest() {
    nock.enableNetConnect()
    helper.unloadAgent(agent)
  }

  t.test('http.get', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    testSignatures('http', 'get', t)
  })

  t.test('http.request', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    testSignatures('http', 'request', t)
  })

  t.test('https.get', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    testSignatures('https', 'get', t)
  })

  t.test('https.request', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    testSignatures('https', 'request', t)
  })

  function getMethodFromName(nodule, method) {
    let _nodule

    if (nodule === 'http') {
      _nodule = http
    }
    if (nodule === 'https') {
      _nodule = https
    }

    return _nodule[method]
  }

  // Iterates through the given module and method, testing each signature combination. For
  // testing the http/https modules and get/request methods.
  function testSignatures(nodule, method, t) {
    const host = 'www.newrelic.com'
    const port = ''
    const path = '/index.html'
    const leftPart = `${nodule}://${host}`
    const _url = `${leftPart}${path}`

    function testSignature(testOpts) {
      const { urlType, headers, callback, swapHost } = testOpts

      // Setup the arguments and the test name
      const args = [] // Setup arguments to the get/request function
      const names = [] // Capture parameters for the name of the test

      // See if a URL argument is being used
      if (urlType === 'string') {
        args.push(_url)
        names.push('URL string')
      } else if (urlType === 'object') {
        args.push(global.URL ? new global.URL(_url) : _url)
        names.push('URL object')
      }

      // See if an options argument should be used
      const opts = {}
      if (headers) {
        opts.headers = { test: 'test' }
        names.push('options')
      }
      // If options specifies a hostname, it will override the url parameter
      if (swapHost) {
        opts.hostname = 'www.google.com'
        names.push('options with different hostname')
      }
      if (Object.keys(opts).length > 0) {
        args.push(opts)
      }

      // If the callback argument should be setup, just add it to the name for now, and
      // setup within the it() call since the callback needs to access the done() function
      if (callback) {
        names.push('callback')
      }

      // Name the test and start it
      const testName = names.join(', ')

      t.test(testName, function (t) {
        // If testing the options overriding the URL argument, set up nock differently
        if (swapHost) {
          nock(`${nodule}://www.google.com`).get(path).reply(200, 'Hello from Google')
        } else {
          nock(leftPart).get(path).reply(200, 'Hello from New Relic')
        }

        // Setup a function to test the response.
        const callbackTester = (res) => {
          testResult(res, testOpts, t)
        }

        // Add callback to the arguments, if used
        if (callback) {
          args.push(callbackTester)
        }

        helper.runInTransaction(agent, function () {
          // Methods have to be retrieved within the transaction scope for instrumentation
          const request = getMethodFromName(nodule, method)
          const clientRequest = request(...args)
          clientRequest.end()

          // If not using a callback argument, setup the callback on the 'response' event
          if (!callback) {
            clientRequest.on('response', callbackTester)
          }
        })
      })
    }

    function testResult(res, { headers, swapHost }, t) {
      let external = `External/${host}${port}${path}`
      let str = 'Hello from New Relic'
      if (swapHost) {
        external = `External/www.google.com${port}/index.html`
        str = 'Hello from Google'
      }

      const segment = contextManager.getContext()

      t.equal(segment.name, external)
      t.equal(res.statusCode, 200)

      res.on('data', (data) => {
        if (headers) {
          t.equal(res.req.headers.test, 'test')
        }
        t.equal(data.toString(), str)
        t.end()
      })
    }

    testSignature({
      urlType: 'object'
    })

    testSignature({
      urlType: 'string'
    })

    testSignature({
      urlType: 'string',
      headers: true
    })

    testSignature({
      urlType: 'object',
      headers: true
    })

    testSignature({
      urlType: 'string',
      callback: true
    })

    testSignature({
      urlType: 'object',
      callback: true
    })

    testSignature({
      urlType: 'string',
      headers: true,
      callback: true
    })

    testSignature({
      urlType: 'object',
      headers: true,
      callback: true
    })

    testSignature({
      urlType: 'string',
      headers: true,
      callback: true,
      swapHost: true
    })

    testSignature({
      urlType: 'object',
      headers: true,
      callback: true,
      swapHost: true
    })
  }
})
