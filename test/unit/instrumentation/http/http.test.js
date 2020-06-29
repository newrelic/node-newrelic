/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test

var DESTINATIONS = require('../../../../lib/config/attribute-filter').DESTINATIONS
var EventEmitter = require('events').EventEmitter
var helper = require('../../../lib/agent_helper')
var hashes = require('../../../../lib/util/hashes')
var Segment = require('../../../../lib/transaction/trace/segment')
var Shim = require('../../../../lib/shim').Shim

var NEWRELIC_ID_HEADER = 'x-newrelic-id'
var NEWRELIC_APP_DATA_HEADER = 'x-newrelic-app-data'
var NEWRELIC_TRANSACTION_HEADER = 'x-newrelic-transaction'

test('built-in http module instrumentation', (t) => {
  t.autoend()

  let http = null
  let agent = null

  let PAYLOAD = JSON.stringify({msg: 'ok'})

  let PAGE = '<html>' +
    '<head><title>test response</title></head>' +
    '<body><p>I heard you like HTML.</p></body>' +
    '</html>'

  t.test('should not cause bootstrapping to fail', (t) => {
    t.autoend()

    let initialize

    t.beforeEach((done) => {
      agent = helper.loadMockedAgent()
      initialize = require('../../../../lib/instrumentation/core/http')

      done()
    })

    t.afterEach((done) => {
      helper.unloadAgent(agent)
      done()
    })

    t.test('when passed no module', (t) => {
      t.doesNotThrow(() => initialize(agent))

      t.end()
    })

    t.test('when passed an empty module', (t) => {
      t.doesNotThrow(() => initialize(agent, {}, 'http', new Shim(agent, 'http')))

      t.end()
    })
  })

  t.test('after loading', (t) => {
    t.autoend()

    t.beforeEach((done) => {
      agent = helper.instrumentMockedAgent()
      done()
    })

    t.afterEach((done) => {
      helper.unloadAgent(agent)
      done()
    })

    t.test('should not have changed createServer\'s declared parameter names', (t) => {
      const fn = require('http').createServer
      /* Taken from
       * https://github.com/dhughes/CoolBeans/blob/master/lib/CoolBeans.js#L199
       */
      const params = fn.toString().match(/function\s+\w*\s*\((.*?)\)/)[1].split(/\s*,\s*/)
      t.equal(params[0], 'requestListener')

      t.end()
    })
  })

  t.test('with outbound request mocked', (t) => {
    t.autoend()

    let options

    t.beforeEach((done) => {
      agent = helper.loadMockedAgent()
      const initialize = require('../../../../lib/instrumentation/core/http')
      http = {
        request: function request(_options) {
          options = _options

          var requested = new EventEmitter()
          requested.path = '/TEST'
          if (options.path) requested.path = options.path

          return requested
        }
      }

      initialize(agent, http, 'http', new Shim(agent, 'http'))

      done()
    })

    t.afterEach((done) => {
      helper.unloadAgent(agent)

      done()
    })

    t.test('should not crash when called with undefined host', (t) => {
      helper.runInTransaction(agent, function() {
        t.doesNotThrow(() => http.request({port: 80}))

        t.end()
      })
    })

    t.test('should not crash when called with undefined port', (t) => {
      helper.runInTransaction(agent, function() {
        t.doesNotThrow(() => http.request({host: 'localhost'}))

        t.end()
      })
    })
  })

  t.test('when running a request', (t) => {
    t.autoend()

    let transaction = null
    let transaction2 = null
    let hookCalled = null
    let server = null
    let external = null

    t.beforeEach((done) => {
      agent = helper.instrumentMockedAgent()

      http = require('http')
      agent.config.attributes.enabled = true
      hookCalled = false

      external = http.createServer(function(request, response) {
        response.writeHead(200, {
          'Content-Length': PAYLOAD.length,
          'Content-Type': 'application/json'
        })
        response.end(PAYLOAD)
      })

      server = http.createServer(function(request, response) {
        transaction = agent.getTransaction()
        t.ok(transaction, 'created transaction')

        if (/\/slow$/.test(request.url)) {
          setTimeout(function() {
            response.writeHead(200, {
              'Content-Length': PAGE.length,
              'Content-Type': 'text/html'
            })
            response.end(PAGE)
          }, 500)
          return
        }

        makeRequest({
          port: 8321,
          host: 'localhost',
          path: '/status',
          method: 'GET'
        }, function() {
          response.writeHead(200, {
            'Content-Length': PAGE.length,
            'Content-Type': 'text/html'
          })
          response.end(PAGE)
        })
      })

      server.on('request', function() {
        transaction2 = agent.getTransaction()
      })

      server.__NR_onRequestStarted = function() {
        hookCalled = true
      }

      external.listen(8321, 'localhost', function() {
        server.listen(8123, 'localhost', function() {
          // The transaction doesn't get created until after the instrumented
          // server handler fires.
          t.notOk(agent.getTransaction())
          done()
        })
      })
    })

    t.afterEach((done) => {
      external.close()
      server.close()
      helper.unloadAgent(agent)

      done()
    })

    function makeRequest(params, cb) {
      const req = http.request(params, function(res) {
        if (res.statusCode !== 200) {
          return cb(null, res.statusCode, null)
        }

        res.setEncoding('utf8')
        res.on('data', function(data) {
          cb(null, res.statusCode, data)
        })
      })

      req.on('error', function(err) {
        // If we aborted the request and the error is a connection reset, then
        // all is well with the world. Otherwise, ERROR!
        if (params.abort && err.code === 'ECONNRESET') {
          cb()
        } else {
          cb(err)
        }
      })

      if (params.abort) {
        setTimeout(function() {
          req.abort()
        }, params.abort)
      }
      req.end()
    }

    t.test('when allow_all_headers is false, only collect allowed agent-specified headers', (t) => {
      agent.config.allow_all_headers = false
      transaction = null
      makeRequest({
        port: 8123,
        host: 'localhost',
        path: '/path',
        method: 'GET',
        headers: {
          'invalid': 'header',
          'referer': 'valid-referer',
          'content-type': 'valid-type'
        }
      }, finish)

      function finish() {
        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        t.notOk(attributes['request.headers.invalid'])
        t.match(attributes, {
          'request.headers.referer': 'valid-referer',
          'request.headers.contentType': 'valid-type'
        })
        t.end()
      }
    })

    t.test('when allow_all_headers is true, collect all headers not filtered by `exclude` rules',
      (t) => {
        agent.config.allow_all_headers = true
        transaction = null
        makeRequest({
          port: 8123,
          host: 'localhost',
          path: '/path',
          method: 'GET',
          headers: {
            'valid': 'header',
            'referer': 'valid-referer',
            'content-type': 'valid-type',
            'X-filtered-out': 'invalid'
          }
        }, finish)

        function finish() {
          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          const segment = transaction.baseSegment
          const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          t.notOk(attributes['request.headers.x-filtered-out'])
          t.notOk(attributes['request.headers.xFilteredOut'])
          t.match(attributes, {
            'request.headers.valid': 'header',
            'request.headers.referer': 'valid-referer',
            'request.headers.contentType': 'valid-type'
          })

          t.match(spanAttributes, {
            'request.headers.valid': 'header',
            'request.headers.referer': 'valid-referer',
            'request.headers.contentType': 'valid-type'
          }, 'attributes added to span')

          t.end()
        }
      })

    t.test('successful request', (t) => {
      transaction = null
      const refererUrl = 'https://www.google.com/search/cats?scrubbed=false'
      const userAgent = 'Palm680/RC1'

      makeRequest({
        port: 8123,
        host: 'localhost',
        path: '/path',
        method: 'GET',
        headers: {
          referer: refererUrl,
          'User-Agent': userAgent
        }
      }, finish)
      
      function finish(err, statusCode, body) {
        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        const callStats = agent.metrics.getOrCreateMetric('WebTransaction/NormalizedUri/*')
        const dispatcherStats = agent.metrics.getOrCreateMetric('HttpDispatcher')
        const reqStats = transaction.metrics.getOrCreateMetric(
          'External/localhost:8321/http',
          'WebTransaction/NormalizedUri/*'
        )

        t.equal(statusCode, 200, 'response status code')
        t.equal(body, PAGE, 'resonse body')

        t.equal(attributes['request.headers.referer'], 'https://www.google.com/search/cats', 'headers.referer')
        t.match(attributes, {
          'request.headers.referer': 'https://www.google.com/search/cats',
          'http.statusCode': '200',
          'http.statusText': 'OK',
          'request.headers.userAgent': userAgent
        }, 'transaction attributes')

        t.match(spanAttributes, {
          'request.headers.referer': 'https://www.google.com/search/cats',
          'request.uri': '/path',
          'http.statusCode': '200',
          'http.statusText': 'OK',
          'request.method': 'GET',
          'request.headers.userAgent': userAgent
        }, 'span attributes')
        t.equal(callStats.callCount, 2, 'records unscoped path stats after a normal request')
        t.ok(dispatcherStats.callCount, 2,
          'record unscoped HTTP dispatcher stats after a normal request')
        t.ok(agent.environment.get('Dispatcher').includes('http'), 'http dispatcher is in play')
        t.equal(reqStats.callCount, 1,
          'associates outbound HTTP requests with the inbound transaction')
        t.equal(transaction.port, 8123, 'set transaction.port to the server\'s port')
        t.match(transaction2, {
          'id': transaction.id
        }, 'only create one transaction for the request')

        t.ok(hookCalled, 'called the shim hook')
        t.end()
      }
    })
  })

  t.test('inbound http requests when cat is enabled', (t) => {
    const encKey = 'gringletoes'
    let agent2

    t.beforeEach((done) => {
      agent2 = helper.instrumentMockedAgent({
        cross_application_tracer: {enabled: true},
        encoding_key: encKey
      })

      done()
    })

    t.afterEach((done) => {
      helper.unloadAgent(agent2)
      done()
    })

    t.test('should add cat headers from request to transaction', (t) => {
      const server = http.createServer(function(req, res) {
        const transaction = agent2.getTransaction()

        t.match(transaction, {
          incomingCatId: '123',
          tripId: 'trip-id-1',
          referringPathHash: '1234abcd',
          'referringTransactionGuid': '789'
        })

        res.end()
        req.socket.end()
        server.close(t.end())
      })

      var transactionHeader = [
        '789',
        false,
        'trip-id-1',
        '1234abcd'
      ]
      var headers = {}
      headers[NEWRELIC_ID_HEADER] = hashes.obfuscateNameUsingKey('123', encKey)
      headers[NEWRELIC_TRANSACTION_HEADER] = hashes.obfuscateNameUsingKey(
        JSON.stringify(transactionHeader),
        encKey
      )

      server.on('listening', function() {
        const port = server.address().port
        http.get({host: 'localhost', port: port, headers: headers})
      })

      helper.startServerWithRandomPortRetry(server)
    })

    t.test('should ignore invalid pathHash', (t) => {
      const server = http.createServer(function(req, res) {
        const transaction = agent2.getTransaction()
        t.notOk(transaction.referringPathHash)
        res.end()
        req.socket.end()
        server.close(t.end())
      })
  
      const transactionHeader = [
        '789',
        false,
        'trip-id-1',
        {}
      ]
      let headers = {}
      headers[NEWRELIC_TRANSACTION_HEADER] = hashes.obfuscateNameUsingKey(
        JSON.stringify(transactionHeader),
        encKey
      )
  
      server.on('listening', function() {
        const port = server.address().port
        http.get({host: 'localhost', port: port, headers: headers})
      })
  
      helper.startServerWithRandomPortRetry(server)
    })

    t.test('should not explode on invalid JSON', (t) => {
      const server = http.createServer(function(req, res) {
        // NEED SOME DEFINITIVE TEST HERE
        res.end()
        req.socket.end()
        server.close(t.end())
      })

      const headers = {}
      headers[NEWRELIC_TRANSACTION_HEADER] = hashes.obfuscateNameUsingKey(
        'not json',
        encKey
      )

      server.on('listening', function() {
        const port = server.address().port
        http.get({host: 'localhost', port: port, headers: headers})
      })

      helper.startServerWithRandomPortRetry(server)
    })
    t.end()
  })

  t.test('inbound http requests when cat is disabled', (t) => {
    const encKey = 'gringletoes'

    t.beforeEach((done) => {
      agent = helper.instrumentMockedAgent({
        cross_application_tracer: {enabled: false},
        encoding_key: encKey
      })
      done()
    })

    t.afterEach((done) => {
      helper.unloadAgent(agent)
      done()
    })

    t.test('should ignore cat headers', (t) => {
      var server = http.createServer(function(req, res) {
        var transaction = agent.getTransaction()
        t.notOk(transaction.incomingCatId)
        t.notOk(transaction.incomingAppData)
        t.notOk(transaction.tripId)
        t.notOk(transaction.referringPathHash)
        t.notOk(agent.tracer.getSegment().getAttributes().transaction_guid)

        res.end()
        req.socket.end()
        server.close(t.end())
      })

      const transactionHeader = [
        '789',
        false,
        'trip-id-1',
        '1234abcd'
      ]
      let headers = {}
      headers[NEWRELIC_ID_HEADER] = hashes.obfuscateNameUsingKey('123', encKey)
      headers[NEWRELIC_APP_DATA_HEADER] = hashes.obfuscateNameUsingKey('456', encKey)
      headers[NEWRELIC_TRANSACTION_HEADER] = hashes.obfuscateNameUsingKey(
        JSON.stringify(transactionHeader),
        encKey
      )

      server.on('listening', () => {
        const port = server.address().port
        http.get({host: 'localhost', port: port, headers: headers})
      })

      helper.startServerWithRandomPortRetry(server)
    })

    t.end()
  })

  t.test('response headers for inbound requests when cat is enabled', (t) => {
    const encKey = 'gringletoes'

    t.beforeEach((done) => {
      agent = helper.instrumentMockedAgent({
        cross_application_tracer: {enabled: true},
        encoding_key: encKey,
        trusted_account_ids: [123],
        cross_process_id: '456'
      })
      done()
    })

    t.afterEach((done) => {
      helper.unloadAgent(agent)
      done()
    })

    t.test('should set header correctly when all data is present', (t) => {
      const server = http.createServer(function(req, res) {
        agent.getTransaction().setPartialName('/abc')
        agent.getTransaction().id = '789'
        res.writeHead(200, {'Content-Length': 3})
        res.end('hi!')
      })

      const headers = {}
      headers[NEWRELIC_ID_HEADER] = hashes.obfuscateNameUsingKey('123', encKey)

      server.on('listening', () => {
        const port = server.address().port

        http.get({host: 'localhost', port: port, headers: headers}, function(res) {
          var data = JSON.parse(hashes.deobfuscateNameUsingKey(
            res.headers['x-newrelic-app-data'],
            encKey
          ))
          t.equal(data[0], '456')
          t.equal(data[1], 'WebTransaction//abc')
          t.equal(data[4], 3)
          t.equal(data[5], '789')
          t.equal(data[6], false)
          res.resume()
          server.close(t.end())
        })
      })

      helper.startServerWithRandomPortRetry(server)
    })

    t.test('should default Content-Length to -1', (t) => {
      const server = http.createServer(function(req, res) {
        res.end()
      })

      const headers = {}
      headers[NEWRELIC_ID_HEADER] = hashes.obfuscateNameUsingKey('123', encKey)

      server.on('listening', function() {
        const port = server.address().port
        http.get({host: 'localhost', port: port, headers: headers}, function(res) {
          var data = JSON.parse(hashes.deobfuscateNameUsingKey(
            res.headers['x-newrelic-app-data'],
            encKey
          ))
          t.equal(data[4], -1)
          res.resume()
          server.close(t.end())
        })
      })

      helper.startServerWithRandomPortRetry(server)
    })

    t.test('should not set header if id not in trusted_account_ids', (t) => {
      const server = http.createServer(function(req, res) {
        res.end()
      })

      const headers = {}
      headers[NEWRELIC_ID_HEADER] = hashes.obfuscateNameUsingKey('!123', encKey)

      server.on('listening', function() {
        const port = server.address().port
        http.get({host: 'localhost', port: port, headers: headers}, function(res) {
          t.notOk(res.headers['x-newrelic-app-data'])
          res.resume()
          server.close(t.end())
        })
      })

      helper.startServerWithRandomPortRetry(server)
    })

    t.test('should fall back to partial name if transaction.name is not set', (t) => {
      const server = http.createServer(function(req, res) {
        agent.getTransaction().nameState.appendPath('/abc')
        res.end()
      })

      const headers = {}
      headers[NEWRELIC_ID_HEADER] = hashes.obfuscateNameUsingKey('123', encKey)

      server.on('listening', function() {
        const port = server.address().port
        http.get({host: 'localhost', port: port, headers: headers}, function(res) {
          const data = JSON.parse(hashes.deobfuscateNameUsingKey(
            res.headers['x-newrelic-app-data'],
            encKey
          ))
          t.equal(data[1], 'WebTransaction/Nodejs/GET//abc')
          res.resume()
          server.close(t.end())
        })
      })

      helper.startServerWithRandomPortRetry(server)
    })

    t.end()
  })

  t.test('Should accept w3c traceparent header when present on request',
    (t) => {
      t.beforeEach((done) => {
        agent = helper.instrumentMockedAgent({
          distributed_tracing: {
            enabled: true
          },
          feature_flag: {
          }
        })
        done()
      })

      t.afterEach((done) => {
        helper.unloadAgent(agent)
        done()
      })

      t.test('should set header correctly when all data is present', (t) => {
        const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
        const priority = 0.789
        // eslint-disable-next-line
        const tracestate = `190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-${priority}-1563574856827`
        http = require('http')
        agent.config.trusted_account_key = 190

        const server = http.createServer(function(req, res) {
          const txn = agent.getTransaction()

          const outboundHeaders = createHeadersAndInsertTrace(txn)

          t.equal(outboundHeaders.traceparent.startsWith('00-4bf92f3577b'), true)
          t.equal(txn.priority, priority)
          res.writeHead(200, {'Content-Length': 3})
          res.end('hi!')
        })

        const headers = {
          traceparent: traceparent,
          tracestate: tracestate
        }

        server.on('listening', function() {
          const port = server.address().port
          http.get({host: 'localhost', port: port, headers: headers}, function(res) {
            res.resume()
            server.close(t.end())
          })
        })

        helper.startServerWithRandomPortRetry(server)
      })

      t.test('should set traceparent header correctly tracestate missing', (t) => {
        const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

        http = require('http')
        agent.config.trusted_account_key = 190

        const server = http.createServer(function(req, res) {
          const txn = agent.getTransaction()

          const outboundHeaders = createHeadersAndInsertTrace(txn)

          t.ok(outboundHeaders.traceparent.startsWith('00-4bf92f3577b'))
          res.writeHead(200, {'Content-Length': 3})
          res.end('hi!')
        })

        const headers = {
          traceparent: traceparent
        }

        server.on('listening', function() {
          const port = server.address().port
          http.get({host: 'localhost', port: port, headers: headers}, function(res) {
            res.resume()
            server.close(t.end())
          })
        })

        helper.startServerWithRandomPortRetry(server)
      })

      t.test('should set traceparent header correctly tracestate empty string', (t) => {
        const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

        const tracestate = ''
        http = require('http')
        agent.config.trusted_account_key = 190

        const server = http.createServer(function(req, res) {
          const txn = agent.getTransaction()
          const outboundHeaders = createHeadersAndInsertTrace(txn)
          t.equal(outboundHeaders.traceparent.startsWith('00-4bf92f3577b'), true)

          res.writeHead(200, {'Content-Length': 3})
          res.end('hi!')
        })

        const headers = {
          traceparent: traceparent,
          tracestate: tracestate
        }

        server.on('listening', function() {
          const port = server.address().port
          http.get({host: 'localhost', port: port, headers: headers}, function(res) {
            res.resume()
            server.close(t.end())
          })
        })

        helper.startServerWithRandomPortRetry(server)
      })

      t.end()
    })

  t.test('response headers for outbound requests when cat is enabled', (t) => {
    const encKey = 'gringletoes'
    let server

    t.beforeEach((done) => {
      agent = helper.instrumentMockedAgent({
        cross_application_tracer: {enabled: true},
        encoding_key: encKey,
        obfuscatedId: 'o123'
      })
      http = require('http')
      server = http.createServer(function(req, res) {
        res.end()
        req.resume()
      })

      helper.randomPort((port) => {
        server.listen(port, done)
      })
    })

    t.afterEach((done) => {
      helper.unloadAgent(agent)
      server.close(done)
    })

    function addSegment() {
      const transaction = agent.getTransaction()
      transaction.type = 'web'
      transaction.baseSegment = new Segment(transaction, 'base-segment')
    }

    t.test('should use config.obfuscatedId as the x-newrelic-id header', (t) => {
      helper.runInTransaction(agent, function() {
        addSegment() // Add web segment so everything works properly

        const port = server.address().port
        const req = http.request({host: 'localhost', port: port}, function(res) {
          t.equal(req.getHeader(NEWRELIC_ID_HEADER), 'o123')
          res.resume()
          agent.getTransaction().end()
          t.end()
        })
        req.end()
      })
    })

    t.test('should use set x-newrelic-transaction', (t) => {
      helper.runInTransaction(agent, function() {
        addSegment() // Add web segment so everything works properly
        const transaction = agent.getTransaction()
        transaction.name = '/abc'
        transaction.referringPathHash = 'h/def'
        transaction.id = '456'
        transaction.tripId = '789'
        var pathHash = hashes.calculatePathHash(
          agent.config.applications()[0],
          transaction.name,
          transaction.referringPathHash
        )

        const port = server.address().port
        const req = http.get({host: 'localhost', port: port}, function(res) {
          const data = JSON.parse(hashes.deobfuscateNameUsingKey(
            req.getHeader(NEWRELIC_TRANSACTION_HEADER),
            encKey
          ))
          t.equal(data[0], '456')
          t.equal(data[1], false)
          t.equal(data[2], '789')
          t.equal(data[3], pathHash)
          res.resume()
          transaction.end()
          t.end()
        })
        req.end()
      })
    })

    t.test('should use transaction.id if transaction.tripId is not set', (t) => {
      helper.runInTransaction(agent, function() {
        addSegment() // Add web segment so everything works properly
        const transaction = agent.getTransaction()
        transaction.id = '456'
        transaction.tripId = null

        const port = server.address().port
        const req = http.get({host: 'localhost', port: port}, function(res) {
          const data = JSON.parse(hashes.deobfuscateNameUsingKey(
            req.getHeader(NEWRELIC_TRANSACTION_HEADER),
            encKey
          ))
          t.equal(data[2], '456')
          res.resume()
          transaction.end()
          t.end()
        })
        req.end()
      })
    })

    t.test('should use partialName if transaction.name is not set', (t) => {
      helper.runInTransaction(agent, function() {
        addSegment() // Add web segment so everything works properly
        const transaction = agent.getTransaction()
        transaction.url = '/xyz'
        transaction.nameState.appendPath('/xyz')
        transaction.name = null
        transaction.referringPathHash = 'h/def'
        const pathHash = hashes.calculatePathHash(
          agent.config.applications()[0],
          transaction.getFullName(),
          transaction.referringPathHash
        )

        const port = server.address().port
        const req = http.get({host: 'localhost', port: port}, function(res) {
          var data = JSON.parse(hashes.deobfuscateNameUsingKey(
            req.getHeader(NEWRELIC_TRANSACTION_HEADER),
            encKey
          ))
          t.equal(data[3], pathHash)
          res.resume()
          transaction.end()
          t.end()
        })
        req.end()
      })
    })

    t.test('should save current pathHash', (t) => {
      helper.runInTransaction(agent, function() {
        addSegment() // Add web segment so everything works properly
        const transaction = agent.getTransaction()
        transaction.name = '/xyz'
        transaction.referringPathHash = 'h/def'
        const pathHash = hashes.calculatePathHash(
          agent.config.applications()[0],
          transaction.name,
          transaction.referringPathHash
        )

        const port = server.address().port
        http.get({host: 'localhost', port: port}, function(res) {
          t.same(transaction.pathHashes, [pathHash])
          res.resume()
          transaction.end ()
          t.end()
        }).end()
      })
    })

    t.end()
  })

  t.test('request headers for outbound request', (t) => {
    t.test('should preserve headers regardless of format', (t) => {
      const encKey = 'gringletoes'

      agent = helper.instrumentMockedAgent({
        cross_application_tracer: {enabled: true},
        encoding_key: encKey,
        obfuscatedId: 'o123'
      })

      http = require('http')
      let had_expect = 0

      const server = http.createServer(function(req, res) {
        if (req.headers.expect) {
          had_expect++
          t.equal(req.headers.expect, '100-continue')
        }
        t.equal(req.headers.a, '1')
        t.equal(req.headers.b, '2')
        t.equal(req.headers['x-newrelic-id'], 'o123')
        res.end()
        req.resume()
      })

      server.on('listening', function() {
        helper.runInTransaction(agent, obj_request)
      })

      helper.startServerWithRandomPortRetry(server)

      function obj_request() {
        addSegment()

        const port = server.address().port
        const req = http.request(
          {host: 'localhost', port: port, headers: {a: 1, b: 2}},
          function(res) {
            res.resume()
            array_request()
          }
        )
        req.end()
      }

      function array_request() {
        addSegment()

        const port = server.address().port
        const req = http.request(
          {host: 'localhost', port: port, headers: [['a', 1], ['b', 2]]},
          function(res) {
            res.resume()
            expect_request()
          }
        )
        req.end()
      }

      function expect_request() {
        addSegment()

        const port = server.address().port
        const req = http.request({
          host: 'localhost',
          port: port,
          headers: {a: 1, b: 2, expect: '100-continue'}
        }, function(res) {
          res.resume()
          end_test()
        })
        req.end()
      }

      function end_test() {
        t.equal(had_expect, 1)
        agent.getTransaction().end()
        helper.unloadAgent(agent)
        server.close(t.end())
      }
    })

    function addSegment() {
      const transaction = agent.getTransaction()
      transaction.type = 'web'
      transaction.baseSegment = new Segment(transaction, 'base-segment')
    }

    t.end()
  })
})

test('http.createServer should trace errors in top-level handlers', (t) => {
  // Once on node 10+ only, may be able to replace with below.
  // t.expectUncaughtException(fn, [expectedError], message, extra)
  // https://node-tap.org/docs/api/asserts/#texpectuncaughtexceptionfn-expectederror-message-extra
  helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

  const http = require('http')
  const agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  let server
  let request

  process.once('uncaughtException', function() {
    const errors = agent.errors.traceAggregator.errors
    t.equal(errors.length, 1)

    // abort request to close connection and
    // allow server to close fast instead of after timeout
    request.abort()
    server.close(() => {
      t.end()
    })
  })

  server = http.createServer(function cb_createServer() {
    throw new Error('whoops!')
  })

  server.listen(8182, function() {
    request = http.get({host: 'localhost', port: 8182}, function() {
      t.end('actually got response')
    })

    request.on('error', function swallowError(err) {
      // eslint-disable-next-line no-console
      console.log('swallowed error: ', err)
    })
  })
})

test('http.request should trace errors in listeners', (t) => {
  // Once on node 10+ only, may be able to replace with below.
  // t.expectUncaughtException(fn, [expectedError], message, extra)
  // https://node-tap.org/docs/api/asserts/#texpectuncaughtexceptionfn-expectederror-message-extra
  helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

  const http = require('http')
  const agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  let server

  process.once('uncaughtException', function() {
    const errors = agent.errors.traceAggregator.errors
    t.equal(errors.length, 1)

    server.close(() => {
      t.end()
    })
  })

  server = http.createServer(function cb_createServer(request, response) {
    response.writeHead(200, {'Content-Type': 'text/plain'})
    response.end()
  })

  server.listen(8183, function() {
    http.get({host: 'localhost', port: 8183}, function() {
      throw new Error('whoah')
    })
  })
})

function createHeadersAndInsertTrace(transaction) {
  const headers = {}
  transaction.insertDistributedTraceHeaders(headers)

  return headers
}
