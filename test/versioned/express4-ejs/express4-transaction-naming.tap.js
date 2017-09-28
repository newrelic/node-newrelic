'use strict'

var helper = require('../../lib/agent_helper.js')
var http = require('http')
var test = require('tap').test


var express
var agent
var app

runTests({
  express_segments: false
})

runTests({
  express_segments: true
})

function runTests(flags) {
  test("transaction name with single route", function(t) {
    setup(t)

    app.get('/path1', function(req, res) {
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test("transaction name with no matched routes", function(t) {
    setup(t)

    app.get('/path1', function(req, res) {
      res.end()
    })

    var endpoint = '/asdf'

    agent.on('transactionFinished', function(transaction) {
      t.equal(
        transaction.name,
        'WebTransaction/Expressjs/GET/(not found)',
        'transaction has expected name'
      )
      t.end()
    })
    var server = app.listen(function() {
      makeRequest(server, endpoint)
    })
    t.tearDown(function cb_tearDown() {
      server.close()
    })
  })

  test("transaction name with route that has multiple handlers", function(t) {
    setup(t)

    app.get('/path1', function(req, res, next) {
      next()
    }, function(req, res) {
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test("transaction name with router middleware", function(t) {
    setup(t)

    var router = new express.Router()
    router.get('/path1', function(req, res, next) {
      res.end()
    })

    app.use(router)

    runTest(t, '/path1', '/path1')
  })

  test("transaction name with middleware function", function(t) {
    setup(t)

    app.use('/path1', function(req, res, next) {
      next()
    })

    app.get('/path1', function(req, res, next) {
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test("transaction name with subapp middleware", function(t) {
    setup(t)

    var subapp = express()

    subapp.get('/path1', function middleware(req, res, next) {
      res.end()
    })

    app.use(subapp)

    runTest(t, '/path1', '/path1')
  })

  test("transaction name with subrouter", function(t) {
    setup(t)

    var router = new express.Router()

    router.get('/path1', function(req, res, next) {
      res.end()
    })

    app.use('/api', router)

    runTest(t, '/api/path1', '/api/path1')
  })

  test("multiple route handlers with the same name do not duplicate transaction name",
      function(t) {
    setup(t)

    app.get('/path1', function(req, res, next) {
      next()
    })

    app.get('/path1', function(req, res) {
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test('responding from middleware', function(t) {
    setup(t)

    app.use('/test', function(req, res, next) {
      res.send('ok')
      next()
    })

    runTest(t, '/test')
  })

  test('responding from middleware with parameter', function(t) {
    setup(t)

    app.use('/test', function(req, res, next) {
      res.send('ok')
      next()
    })

    runTest(t, '/test/param', '/test')
  })

  test('with error', function(t) {
    setup(t)

    app.get('/path1', function(req, res, next) {
      next(new Error('some error'))
    })

    app.use(function(err, req, res, next) {
      return res.status(500).end()
    })

    runTest(t, '/path1', '/path1')
  })

  test('with error and an error handler', function(t) {
    setup(t)

    app.get('/path1', function(req, res, next) {
      next(new Error('some error'))
    })

    app.use(function(err, req, res, next) {
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test('when router error is handled outside of the router', function(t) {
    setup(t)

    var router = new express.Router()

    router.get('/path1', function(req, res, next) {
      next(new Error('some error'))
    })

    app.use('/router1', router)

    app.use(function errorHandler(err, req, res, next) {
      return res.status(500).end()
    })

    runTest(t, '/router1/path1', '/router1/path1')
  })

  test('when using a route variable', function(t) {
    setup(t)

    app.get('/:foo/:bar', function(req, res) {
      res.end()
    })

    runTest(t, '/foo/bar', '/:foo/:bar')
  })

  test('when using a string pattern in path', function(t) {
    setup(t)

    app.get('/ab?cd', function(req, res) {
      res.end()
    })

    runTest(t, '/abcd', '/ab?cd')
  })

  test('when using a regular expression in path', function(t) {
    setup(t)

    app.get(/a/, function(req, res) {
      res.end()
    })

    runTest(t, '/abcd', '/a/')
  })

  test('when using router with a route variable', function(t) {
    setup(t)

    var router = express.Router()

    router.get('/:var2/path1', function(req, res) {
      res.end()
    })

    app.use('/:var1', router)

    runTest(t, '/foo/bar/path1', '/:var1/:var2/path1')
  })

  test('when mounting a subapp using a variable', function(t) {
    setup(t)

    var subapp = express()
    subapp.get('/:var2/path1', function(req, res) {
      res.end()
    })

    app.use('/:var1', subapp)

    runTest(t, '/foo/bar/path1', '/:var1/:var2/path1')
  })

  test('using two routers', function(t) {
    setup(t)

    var router1 = express.Router()
    var router2 = express.Router()

    app.use('/:router1', router1)
    router1.use('/:router2', router2)

    router2.get('/path1', function(req, res) {
      res.end()
    })

    runTest(t, '/router1/router2/path1', '/:router1/:router2/path1')
  })

  test('transactions running in parallel should be recorded correctly', function(t) {
    setup(t)
    var router1 = express.Router()
    var router2 = express.Router()

    app.use('/:router1', router1)
    router1.use('/:router2', router2)

    router2.get('/path1', function(req, res) {
      setTimeout(function() {
        res.end()
      }, 0)
    })

    var numTests = 4
    var runner = makeMultiRunner(t,
      '/router1/router2/path1',
      '/:router1/:router2/path1',
      numTests
    )
    var server = app.listen(function() {
      t.tearDown(function cb_tearDown() {
        server.close()
      })
      for (var i = 0; i < numTests; i++) {
        runner(server)
      }
    })
  })

  test('names transaction when request is aborted', function(t) {
    t.plan(4)
    setup(t)

    app.get('/test', function(req, res, next) {
      t.ok(agent.getTransaction(), 'transaction exists')
      // generate error after client has aborted
      setTimeout(function() {
        t.ok(agent.getTransaction() == null, 'transaction has already ended')
        next(new Error('some error'))
      }, 20)
    })

    app.use(function(error, req, res, next) {
      t.ok(agent.getTransaction() == null, 'no active transaction when responding')
      res.end()
    })

    var server = app.listen(function() {
      var port = server.address().port
      var req = http.request({port: port, path: '/test'}, function() {})
      req.end()
      // add error handler, otherwise aborting will cause an exception
      req.on('error', function() {})

      setTimeout(function() {
        req.abort()
      }, 10)
    })

    agent.on('transactionFinished', function(tx) {
      t.equal(tx.name, 'WebTransaction/Expressjs/GET//test')
    })

    t.tearDown(function cb_tearDown() {
      server.close()
    })
  })

  test('when next is called after transaction state loss', function(t) {
    // Uninstrumented work queue. This must be set up before the agent is loaded
    // so that no transaction state is maintained.
    var tasks = []
    var interval = setInterval(function() {
      if (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    setup(t)
    t.plan(3)

    var transactionsFinished = 0
    var transactionNames = [
      'WebTransaction/Expressjs/GET//bar',
      'WebTransaction/Expressjs/GET//foo'
    ]
    agent.on('transactionFinished', function(tx) {
      t.equal(
        tx.name,
        transactionNames[transactionsFinished++],
        'should have expected name ' + transactionsFinished
      )
    })

    app.use('/foo', function(req, res, next) {
      setTimeout(function() {
        tasks.push(next)
      }, 5)
    })

    app.get('/foo', function(req, res) {
      setTimeout(function() {
        res.send('foo done\n')
      }, 500)
    })

    app.get('/bar', function(req, res) {
      res.send('bar done\n')
    })

    var server = app.listen(function() {
      var port = server.address().port

      // Send first request to `/foo` which is slow and uses the work queue.
      http.get({port: port, path: '/foo'}, function(res) {
        res.resume()
        res.on('end', function() {
          t.equal(transactionsFinished, 2, 'should have two transactions done')
          t.end()
        })
      })

      // Send the second request after a short wait `/bar` which is fast and
      // does not use the work queue.
      setTimeout(function() {
        http.get({port: port, path: '/bar'}, function(res) {
          res.resume()
        })
      }, 100)
    })
    t.tearDown(function() {
      server.close()
      clearInterval(interval)
    })
  })

  function setup(t) {
    agent = helper.instrumentMockedAgent(flags)
    express = require('express')
    app = express()
    t.tearDown(function cb_tearDown() {
      helper.unloadAgent(agent)
    })
  }

  function makeMultiRunner(t, endpoint, expectedName, numTests) {
    var done = 0
    var seen = []
    if (!expectedName) expectedName = endpoint
    agent.on('transactionFinished', function(transaction) {
      t.ok(seen.indexOf(transaction) === -1,
          'should never see the finishing transaction twice')
      seen.push(transaction)
      t.equal(transaction.name, 'WebTransaction/Expressjs/GET/' + expectedName,
        "transaction has expected name")
      transaction.end()
      if (++done === numTests) {
        done = 0
        t.end()
      }
    })
    return function runMany(server) {
      makeRequest(server, endpoint)
    }
  }

  function runTest(t, endpoint, expectedName) {
    if (!expectedName) expectedName = endpoint
    agent.on('transactionFinished', function(transaction) {
      t.equal(transaction.name, 'WebTransaction/Expressjs/GET/' + expectedName,
        "transaction has expected name")
      t.end()
    })
    var server = app.listen(function() {
      makeRequest(server, endpoint)
    })
    t.tearDown(function cb_tearDown() {
      server.close()
    })
  }

  function makeRequest(server, path, callback) {
    var port = server.address().port
    http.request({port: port, path: path}, callback).end()
  }
}
