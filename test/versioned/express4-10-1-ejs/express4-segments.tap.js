'use strict'

var helper = require('../../lib/agent_helper.js')
var http = require('http')
var NAMES = require('../../../lib/metrics/names.js')
var assertMetrics = require('../../lib/metrics_helper').assertMetrics

var test = require('tap').test

var express
var agent
var app


test('first two segments are built-in Express middlewares', function(t) {
  setup(t)

  app.all('/test', function(req, res) {
    res.end()
  })

  runTest(t, function(segments, transaction) {
    // TODO: check for different HTTP methods
    t.equal(segments.length, 3)
    t.equal(segments[0].name, NAMES.EXPRESS.MIDDLEWARE + 'query')
    t.equal(segments[1].name, NAMES.EXPRESS.MIDDLEWARE + 'expressInit')

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//test'
    ])

    t.end()
  })
})

test('segments for route handler', function(t) {
  setup(t)

  app.all('/test', function(req, res) {
    res.end()
  })

  runTest(t, function(segments, transaction) {
    t.equals(segments.length, 3)
    var routeSegment = segments[2]
    t.equal(routeSegment.name, NAMES.EXPRESS.PREFIX + 'Route Path: /test')
    t.equal(routeSegment.children.length, 1)
    t.equal(routeSegment.children[0].name, NAMES.EXPRESS.MIDDLEWARE + 'anonymous')

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//test'
    ])

    t.end()
  })
})

test('route function names are in segment names', function(t) {
  setup(t)

  app.all('/test', function myHandler(req, res) {
    res.end()
  })

  runTest(t, function(segments, transaction) {
    t.equal(segments[2].children[0].name, NAMES.EXPRESS.MIDDLEWARE + 'myHandler')

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'
    ])

    t.end()
  })
})

test('each handler in route has its own segment', function(t) {
  setup(t)

  app.all('/test', function handler1(req, res, next) {
    next()
  }, function handler2(req, res, next) {
    res.send()
  })

  runTest(t, function(segments, transaction) {
    var routeSegment = segments[2]
    t.equal(routeSegment.children.length, 2)
    t.equal(routeSegment.children[0].name, NAMES.EXPRESS.MIDDLEWARE + 'handler1')
    t.equal(routeSegment.children[1].name, NAMES.EXPRESS.MIDDLEWARE + 'handler2')

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'handler1//test',
      NAMES.EXPRESS.MIDDLEWARE + 'handler2//test'
    ])

    t.end()
  })
})

test('segments for routers', function(t) {
  setup(t)

  var router = express.Router()
  router.all('/test', function(req, res) {
    res.end()
  })

  app.use('/router1', router)

  runTest(t, '/router1/test', function(segments, transaction) {
    var routerSegment = segments[2]
    t.equal(routerSegment.name, NAMES.EXPRESS.PREFIX + 'Router: /router1')
    t.equal(routerSegment.children.length, 1)
    var routeSegment = routerSegment.children[0]
    t.equal(routeSegment.name, NAMES.EXPRESS.PREFIX + 'Route Path: /test')
    t.equal(routeSegment.children.length, 1)
    t.equal(routeSegment.children[0].name, NAMES.EXPRESS.MIDDLEWARE + 'anonymous')

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//router1/test'
    ], '/router1/test')

    t.end()
  })
})

test('segments for sub-app', function(t) {
  setup(t)

  var subapp = express()
  subapp.all('/test', function(req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  runTest(t, '/subapp1/test', function(segments, transaction) {
    var subappSegment = segments[2]
    t.equal(subappSegment.name, NAMES.EXPRESS.PREFIX + 'Mounted App: /subapp1')
    t.equal(subappSegment.children.length, 3)
    var routeSegment = subappSegment.children[2]
    t.equal(routeSegment.name, NAMES.EXPRESS.PREFIX + 'Route Path: /test')
    t.equal(routeSegment.children.length, 1)
    t.equal(routeSegment.children[0].name, NAMES.EXPRESS.MIDDLEWARE + 'anonymous')

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//subapp1/test',
      NAMES.EXPRESS.MIDDLEWARE + 'query//subapp1',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit//subapp1'
    ], '/subapp1/test')

    t.end()
  })
})

test('segments for sub-app', function(t) {
  setup(t)

  var subapp = express()
  subapp.get('/test', function(req, res, next) {
    next()
  }, function(req, res, next) {
    next()
  })
  subapp.get('/test', function(req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  runTest(t, '/subapp1/test', function(segments, transaction) {
    var subappSegment = segments[2]
    t.equal(subappSegment.name, NAMES.EXPRESS.PREFIX + 'Mounted App: /subapp1')
    t.equal(subappSegment.children.length, 4)
    var routeSegment = subappSegment.children[2]
    t.equal(routeSegment.name, NAMES.EXPRESS.PREFIX + 'Route Path: /test')
    t.equal(routeSegment.children.length, 2)
    t.equal(routeSegment.children[0].name, NAMES.EXPRESS.MIDDLEWARE + 'anonymous')

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//subapp1/test',
      NAMES.EXPRESS.MIDDLEWARE + 'query//subapp1',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit//subapp1'
    ], '/subapp1/test')

    t.end()
  })
})

test('segments for wildcard', function(t) {
  setup(t)

  var subapp = express()
  subapp.all('/:app', function(req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  runTest(t, '/subapp1/test', function(segments, transaction) {
    var subappSegment = segments[2]
    t.equal(subappSegment.name, NAMES.EXPRESS.PREFIX + 'Mounted App: /subapp1')
    t.equal(subappSegment.children.length, 3)
    var routeSegment = subappSegment.children[2]
    t.equal(routeSegment.name, NAMES.EXPRESS.PREFIX + 'Route Path: /:app')
    t.equal(routeSegment.children.length, 1)
    t.equal(routeSegment.children[0].name, NAMES.EXPRESS.MIDDLEWARE + 'anonymous')

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//subapp1/:app',
      NAMES.EXPRESS.MIDDLEWARE + 'query//subapp1',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit//subapp1'
    ], '/subapp1/:app')

    t.end()
  })
})

test('router with subapp', function(t) {
  setup(t)

  var router = express.Router()
  var subapp = express()
  subapp.all('/test', function(req, res) {
    res.end()
  })
  router.use('/subapp1', subapp)
  app.use('/router1', router)

  runTest(t, '/router1/subapp1/test', function(segments, transaction) {
    var routerSegment = segments[2]
    t.equal(routerSegment.name, NAMES.EXPRESS.PREFIX + 'Router: /router1')
    t.equal(routerSegment.children.length, 1)
    var subappSegment = routerSegment.children[0]
    t.equal(subappSegment.name, NAMES.EXPRESS.PREFIX + 'Mounted App: /subapp1')
    t.equal(subappSegment.children.length, 3)
    t.equal(subappSegment.children[2].name, NAMES.EXPRESS.PREFIX + 'Route Path: /test')

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//router1/subapp1/test',
      NAMES.EXPRESS.MIDDLEWARE + 'query//router1/subapp1',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit//router1/subapp1'
    ], '/router1/subapp1/test')

    t.end()
  })
})

function setup(t) {
  agent = helper.instrumentMockedAgent({
    express_segments: true
  })
  express = require('express')
  app = express()
  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })
}

function runTest(t, endpoint, callback) {
  var statusCode
  var errors

  if (endpoint instanceof Function) {
    callback = endpoint
    endpoint = '/test'
  }

  agent.on('transactionFinished', function(tx) {
    var webSegment = tx.trace.root.children[0]
    callback(webSegment.children, tx)
  })

  var server = app.listen(function(){
    makeRequest(server, endpoint, function(response) {
      response.resume()
    })
  })
  t.tearDown(function cb_tearDown() {
    server.close()
  })
}

function makeRequest(server, path, callback) {
  var port = server.address().port
  http.request({port: port, path: path}, callback).end()
}

function checkMetrics(test, metrics, expected, path) {
  if (path === undefined) {
    path = '/test'
  }
  var expectedAll = [
    [{name  : 'WebTransaction'}],
    [{name  : 'WebTransactionTotalTime'}],
    [{name  : 'HttpDispatcher'}],
    [{name  : 'WebTransaction/Expressjs/GET/' + path}],
    [{name  : 'WebTransactionTotalTime/Expressjs/GET/' + path}],
    [{name  : 'Apdex/Expressjs/GET/' + path}],
    [{name  : 'Apdex'}],
    [{name  : NAMES.EXPRESS.MIDDLEWARE + 'query//'}],
    [{name  : NAMES.EXPRESS.MIDDLEWARE + 'expressInit//'}],
    [{name  : NAMES.EXPRESS.MIDDLEWARE + 'query//',
      scope: 'WebTransaction/Expressjs/GET/' + path}],
    [{name  : NAMES.EXPRESS.MIDDLEWARE + 'expressInit//',
      scope: 'WebTransaction/Expressjs/GET/' + path}],
  ]

  for (var i = 0; i < expected.length; i++) {
    var metric = expected[i]
    expectedAll.push([{name: metric}])
    expectedAll.push([{name: metric, scope: 'WebTransaction/Expressjs/GET/' + path}])
  }

  assertMetrics(metrics, expectedAll, true, false)
}
