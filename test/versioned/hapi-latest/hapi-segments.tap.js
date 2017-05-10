'use strict'

// hapi 10.x and higher works on Node 4 and higher
var semver = require('semver')
if (semver.satisfies(process.versions.node, '<4.0')) return

var test    = require('tap').test
var helper = require('../../lib/agent_helper.js')
var http = require('http')
var NAMES = require('../../../lib/metrics/names.js')
var assertMetrics = require('../../lib/metrics_helper').assertMetrics
var assertSegments = require('../../lib/metrics_helper').assertSegments

var TEST_PORT = 8089
var TEST_HOST = 'localhost'

var hapi
var agent
var server


test('route handler is recorded as middleware', function(t) {
  setup(t)

  server.route({
    method: 'GET',
    path: '/test',
    handler: function myHandler(request, reply) {
      reply('ok')
    }
  })

  runTest(t, function(segments, transaction) {
    checkMetrics(t, transaction.metrics, [
      NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
    ])
    checkSegments(t, transaction.trace.root.children[0], [
      NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
    ])
    t.end()
  })
})

test('extensions are recorded as middleware', function(t) {
  setup(t)

  server.ext('onRequest', function(request, reply) {
    reply.continue()
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: function myHandler(request, reply) {
      reply('ok')
    }
  })

  runTest(t, function(segments, transaction) {
    checkMetrics(t, transaction.metrics, [
      NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
      NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
    ])
    checkSegments(t, transaction.trace.root.children[0], [
      NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
      NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
    ])
    t.end()
  })
})

function runTest(t, callback) {
  agent.on('transactionFinished', function(tx) {
    var baseSegment = tx.trace.root.children[0]
    callback(baseSegment.children, tx)
  })

  server.start(function() {
    makeRequest(server, 'http://localhost:8089/test', function(response) {
      response.resume()
    })
  })

  t.tearDown(function cb_tearDown() {
    server.stop()
  })
}

function setup(t) {
  agent = helper.instrumentMockedAgent()
  hapi = require('hapi')

  server = new hapi.Server()
  server.connection({
    host: TEST_HOST,
    port: TEST_PORT
  })

  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })
}

function makeRequest(server, path, callback) {
  var port = TEST_PORT
  http.request({port: port, path: path}, callback).end()
}

function checkSegments(t, segments, expected, opts) {
  t.doesNotThrow(function() {
    assertSegments(segments, expected, opts)
  }, 'should have expected segments')
}

function checkMetrics(t, metrics, expected, path) {
  if (path === undefined) {
    path = '/test'
  }
  var expectedAll = [
    [{name  : 'WebTransaction'}],
    [{name  : 'WebTransactionTotalTime'}],
    [{name  : 'HttpDispatcher'}],
    [{name  : 'WebTransaction/Hapi/GET/' + path}],
    [{name  : 'WebTransactionTotalTime/Hapi/GET/' + path}],
    [{name  : 'Apdex/Hapi/GET/' + path}],
    [{name  : 'Apdex'}]
  ]

  for (var i = 0; i < expected.length; i++) {
    var metric = expected[i]
    expectedAll.push([{name: metric}])
    expectedAll.push([{name: metric, scope: 'WebTransaction/Hapi/GET/' + path}])
  }

  assertMetrics(metrics, expectedAll, true, false)
}
