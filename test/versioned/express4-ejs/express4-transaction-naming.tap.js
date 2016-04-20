'use strict'

var path = require('path')
var helper = require('../../lib/agent_helper.js')
var http = require('http')
var skip = require('./skip')

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
  test("transaction name with single route",
      function (t) {
    setup(t)

    app.get('/path1', function(req, res, next){
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test("transaction name with route that has multiple handlers",
      function (t) {
    setup(t)

    app.get('/path1', function(req, res, next){
      next()
    }, function(req, res) {
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test("transaction name with router middleware",
      function (t) {
    setup(t)

    var router = new express.Router()
    router.get('/path1', function(req, res, next){
      res.end()
    })

    app.use(router)

    runTest(t, '/path1', '/path1')
  })

  test("transaction name with middleware function",
      function (t) {
    setup(t)

    app.use('/path1', function(req, res, next) {
      next()
    })

    app.get('/path1', function(req, res, next){
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test("transaction name with subapp middleware",
      function (t) {
    setup(t)

    var subapp = express()

    subapp.get('/path1', function(req, res, next){
      res.end()
    })

    app.use(subapp)

    runTest(t, '/path1', '/path1')
  })

  test("transaction name with subrouter",
      function (t) {
    setup(t)

    var router = new express.Router()

    router.get('/path1', function(req, res, next){
      res.end()
    })

    app.use('/api', router)

    runTest(t, '/api/path1', '/api/path1')
  })

  test("multiple route handlers with the same name do not duplicate transaction name",
      function (t) {
    setup(t)

    app.get('/path1', function(req, res, next){
      next()
    })

    app.get('/path1', function(req, res){
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test('responding from middleware', {skip: skip()}, function(t) {
    setup(t)

    app.use('/test', function(req, res, next) {
      res.send('ok')
      next()
    })

    runTest(t, '/test')
  })

  test('responding from middleware with parameter', {skip: skip()}, function(t) {
    setup(t)

    app.use('/test', function(req, res, next) {
      res.send('ok')
      next()
    })

    runTest(t, '/test/param', '/test')
  })

  test('when router error is handled outside of the router', function(t) {
    setup(t)

    var router = new express.Router()

    router.get('/path1', function(req, res, next) {
      next(new Error('some error'))
    })

    app.use('/router1', router)

    app.use(function(err, req, res, next) {
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

    runTest(t, '/abcd', '/a')
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
      setTimeout(function () {
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
    agent.on('transactionFinished', function (transaction) {
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
    agent.on('transactionFinished', function (transaction) {
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
