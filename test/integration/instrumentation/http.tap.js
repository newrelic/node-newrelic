'use strict'

var path       = require('path')
  , tap        = require('tap')
  , test       = tap.test
  , http       = require('http')
  , helper     = require('../../lib/agent_helper.js')
  , StreamSink = require('../../../lib/util/stream-sink.js')


test("built-in http instrumentation should handle internal & external requests",
     function (t) {
  t.plan(13)

  var agent = helper.instrumentMockedAgent()

  var TEST_INTERNAL_PORT = 8123
    , TEST_INTERNAL_PATH = '/path'
    , TEST_EXTERNAL_PORT = 8321
    , TEST_EXTERNAL_PATH = '/status'
    , TEST_HOST          = 'localhost'
    , PAYLOAD            = JSON.stringify({msg : 'ok'})
    , PAGE               = '<html>' +
                           '<head><title>test response</title></head>' +
                           '<body><p>I heard you like HTML.</p></body>' +
                           '</html>'


  var external = http.createServer(function cb_createServer(request, response) {
    response.writeHead(200,
                       {'Content-Length' : PAYLOAD.length,
                        'Content-Type'   : 'application/json'})
    response.end(PAYLOAD)
  })

  // save for later use in the test response handler
  var transaction
  var internalResponseHandler = function (response) {
    return function (requestResponse) {
      transaction = agent.getTransaction()
      t.ok(transaction, "handler is part of transaction")

      if (requestResponse.statusCode !== 200) return t.fail(requestResponse.statusCode)

      requestResponse.setEncoding('utf8')
      requestResponse.on('data', function (data) {
        t.equal(data, PAYLOAD, "response handler shouldn't alter payload")
      })

      response.writeHead(200,
                         {'Content-Length' : PAGE.length,
                          'Content-Type'   : 'text/html'})
      response.end(PAGE)
    }
  }

  var server = http.createServer(function cb_createServer(request, response) {
    t.ok(agent.getTransaction(), "should be within the scope of the transaction")

    var req = http.request({host   : TEST_HOST,
                            port   : TEST_EXTERNAL_PORT,
                            path   : TEST_EXTERNAL_PATH,
                            method : 'GET'},
                           internalResponseHandler(response))

    req.on('error', function (error) { t.fail(error); })

    req.end()
  })

  this.tearDown(function cb_tearDown() {
    external.close()
    server.close()
    helper.unloadAgent(agent)
  })

  var testResponseHandler = function (response) {
    if (response.statusCode !== 200) return t.fail(response.statusCode)

    response.setEncoding('utf8')

    var fetchedBody = ''
    response.on('data', function (data) { fetchedBody += data; })

    // this is where execution ends up -- test asserts go here
    response.on('end', function () {
      if (!transaction) {
        t.fail("Transaction wasn't set by response handler")
        return this.end()
      }

      t.equals(response.statusCode, 200, "should successfully fetch the page")
      t.equals(fetchedBody, PAGE, "page shouldn't change")

      var scope = 'WebTransaction/NormalizedUri/*'
        , stats = agent.metrics.getOrCreateMetric(scope)
        , found = false


      t.equals(transaction.name, scope, 'transaction name should be set')
      t.equals(
        transaction.name,
        transaction.webSegment.name,
        'webSegment name should match transaction name'
      )

      t.equals(stats.callCount, 2,
               "should record unscoped path stats after a normal request")

      agent.environment.toJSON().forEach(function cb_forEach(pair) {
        if (pair[0] === 'Dispatcher' && pair[1] === 'http') found = true
      })
      t.ok(found, "should indicate that the http dispatcher is in play")

      stats = agent.metrics.getOrCreateMetric('HttpDispatcher')
      t.equals(stats.callCount, 2,
               "should have accounted for all the internal http requests")

      stats = agent.metrics.getOrCreateMetric('External/localhost:8321/http', scope)
      t.equals(stats.callCount, 1,
               "should record outbound HTTP requests in the agent's metrics")

      stats = transaction.metrics.getOrCreateMetric('External/localhost:8321/http',
                                                    scope)
      t.equals(stats.callCount, 1,
               "should associate outbound HTTP requests with the inbound transaction")

      t.end()
    })
  }.bind(this)

  external.listen(TEST_EXTERNAL_PORT, TEST_HOST, function () {
    server.listen(TEST_INTERNAL_PORT, TEST_HOST, function () {
      // The transaction doesn't get created until after the instrumented
      // server handler fires.
      t.notOk(agent.getTransaction(),
              "transaction hasn't been created until the first request")

      var req = http.request({host   : TEST_HOST,
                              port   : TEST_INTERNAL_PORT,
                              path   : TEST_INTERNAL_PATH,
                              method : 'GET'},
                             testResponseHandler)

      req.on('error', function (error) { t.fail(error); })

      req.end()
    })
  })
})

test("built-in http instrumentation shouldn't swallow errors",
     function (t) {
  t.plan(8)

  var agent = helper.instrumentMockedAgent()

  function handleRequest(req, res) {
    process.once('uncaughtException', function (error) {
      t.ok(error, "got error in uncaughtException handler.")
      res.statusCode = 501

      res.end()
    })

    // this is gonna blow up
    var x = x.dieshere.ohno
  }

  function makeRequest() {
    // 0.10 agents don't time out
    var options = {
      host  : 'localhost',
      port  : 1337,
      path  : '/',
      agent : false
    }

    http.get(options, function (res) {
      t.equal(res.statusCode, 501, "got expected (error) status code")

      var errors = agent.errors.errors
      t.ok(errors, "errors were found")
      t.equal(errors.length, 2, "should be 2 errors")

      var first = errors[0]
      var second = errors[1]
      t.ok(first, "have the first error")

      t.equal(first[2], "Cannot read property 'dieshere' of undefined",
              "got the expected error")

      t.ok(second, "have the second error")

      t.equal(second[2], "HttpError 501",
              "got the expected error")

      t.end()
    })
  }

  var server = http.createServer(handleRequest)

  this.tearDown(function cb_tearDown() {
    server.close()
    helper.unloadAgent(agent)
  })

  server.listen(1337, makeRequest)
})

test("built-in http instrumentation making outbound requests", function (t) {
  var agent = helper.instrumentMockedAgent()

  var server = http.createServer(function cb_createServer(req, res) {
    var body = '{"status":"ok"}'
    res.writeHead(200, {
      'Content-Length' : body.length,
      'Content-Type'   : 'text/plain' })
    res.end(body)
  })

  this.tearDown(function cb_tearDown() {
    server.close()
    helper.unloadAgent(agent)
  })

  function request(type, options, next) {
    http.request(options, function (res) {
      t.equal(res.statusCode, 200, "got HTTP OK status code")

      var sink = new StreamSink(function (err, body) {
        if (err) {
          t.fail(err)
          return t.end()
        }

        t.deepEqual(JSON.parse(body), {status : 'ok'},
                    "request with " + type + " defined succeeded")
        next()
      })
      res.pipe(sink)
    }).end()
  }

  function requestWithHost(next) {
    request('options.host', {
      host  : 'localhost',
      port  : 1337,
      path  : '/',
      agent : false
    }, next)
  }

  function requestWithHostname(next) {
    request('options.hostname', {
      hostname : 'localhost',
      port     : 1337,
      path     : '/',
      agent    : false
    }, next)
  }

  function requestWithNOTHING(next) {
    request('nothing', {
      port     : 1337,
      path     : '/',
      agent    : false
    }, next)
  }

  server.listen(1337, function () {
    helper.runInTransaction(agent, function () {
      requestWithHost(function () {
        requestWithHostname(function () {
          requestWithNOTHING(function () {
            t.end()
          })
        })
      })
    })
  })
})

test("built-in http instrumentation making outbound requests obsoletely", function (t) {
  var agent = helper.instrumentMockedAgent()

  var server = http.createServer(function cb_createServer(req, res) {
    var body = '{"status":"ok"}'
    res.writeHead(200, {
      'Content-Length' : body.length,
      'Content-Type'   : 'text/plain' })
    res.end(body)
  })

  this.tearDown(function cb_tearDown() {
    server.close()
    helper.unloadAgent(agent)
  })

  function request(type, options, next) {
    var port = options.port
    var host = options.host
    var path = options.path

    var req = http.createClient(port, host).request('GET', path)
    req.on('response', function (res) {
      res.on('end', function () {
        t.equal(res.statusCode, 200, "got HTTP OK status code")
      })

      var sink = new StreamSink(function (err, body) {
        if (err) {
          t.fail(err)
          return t.end()
        }

        t.deepEqual(JSON.parse(body), {status : 'ok'},
                    "request with " + type + " defined succeeded")
        next()
      })
      res.pipe(sink)
    })
    req.end()
  }

  function requestWithHost(next) {
    request('options.host', {
      host  : 'localhost',
      port  : 1337,
      path  : '/',
      agent : false
    }, next)
  }

  function requestWithHostname(next) {
    request('options.hostname', {
      hostname : 'localhost',
      port     : 1337,
      path     : '/',
      agent    : false
    }, next)
  }

  function requestWithNOTHING(next) {
    request('nothing', {
      port     : 1337,
      path     : '/',
      agent    : false
    }, next)
  }

  server.listen(1337, function () {
    helper.runInTransaction(agent, function () {
      requestWithHost(function () {
        requestWithHostname(function () {
          requestWithNOTHING(function () {
            t.end()
          })
        })
      })
    })
  })
})

test("built-in http instrumentation should not crash for requests that are in progress" +
  " when the server is closed", function(t) {
  t.plan(5)

  var agent = helper.instrumentMockedAgent()

  this.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })

  var count = 0
  var closing = false
  var server = http.createServer(function(req, res) {
    count++

    if (count === 1) {
      t.ok(true, 'request #1 was received')
      res.end()

      closing = true
      server.close()
    } else {
      t.ok(true, 'request #2 was received')
      t.notOk(!closing,
        'server should be in the middle of closing when request #2 is handled')
      res.end()
    }
  })

  server.listen(0, function() {
    // make two quick requests
    makeRequest(function() {
      t.ok(true, 'request #1 got response')
    })

    makeRequest(function() {
      t.ok(true, 'request #2 got response')
    })
  })

  function makeRequest(callback) {
    var options = {
      hostname: 'localhost',
      port: server.address().port,
      path: '/',
      agent: false
    }
    http.request(options, callback).end()
  }
})
