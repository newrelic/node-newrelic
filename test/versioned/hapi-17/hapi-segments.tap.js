'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper')
var http = require('http')
var NAMES = require('../../../lib/metrics/names')
var assertMetrics = require('../../lib/metrics_helper').assertMetrics
var assertSegments = require('../../lib/metrics_helper').assertSegments
var conditions = require('./conditions')

var TEST_PORT = 8089
var TEST_HOST = 'localhost'

var hapi
var agent
var server

tap.test('Hapi segments', conditions, function(t) {
  t.autoend()

  t.test('route handler is recorded as middleware', conditions, function(t) {
    setup(t)

    server.route({
      method: 'GET',
      path: '/test',
      handler: function myHandler() {
        return 'ok'
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

  t.test('custom handler type is recorded as middleware', function(t) {
    setup(t)

    server.decorate('handler', 'customHandler', function(route, options) {
      return function customHandler() {
        return options.key1
      }
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: {customHandler: {key1: 'val1'}}
    })

    runTest(t, function(segments, transaction) {
      checkMetrics(t, transaction.metrics, [
        NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
      ])
      checkSegments(t, transaction.trace.root.children[0], [
        NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
      ])
      t.end()
    })
  })

  t.test('extensions are recorded as middleware', function(t) {
    setup(t)

    server.ext('onRequest', function(req, h) {
      return h.continue
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: function myHandler() {
        return 'ok'
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
})

function runTest(t, callback) {
  agent.on('transactionFinished', function(tx) {
    var baseSegment = tx.trace.root.children[0]
    callback(baseSegment.children, tx)
  })

  server.start().then(function() {
    makeRequest(server, 'http://localhost:8089/test', function(response) {
      response.resume()
    })
  })

  t.tearDown(function() {
    return server.stop()
  })
}

function setup(t) {
  agent = helper.instrumentMockedAgent()
  hapi = require('hapi')
  server = new hapi.Server({
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
  path = path || '/test'
  var expectedAll = [
    [{name: 'WebTransaction'}],
    [{name: 'WebTransactionTotalTime'}],
    [{name: 'HttpDispatcher'}],
    [{name: 'WebTransaction/Hapi/GET/' + path}],
    [{name: 'WebTransactionTotalTime/Hapi/GET/' + path}],
    [{name: 'Apdex/Hapi/GET/' + path}],
    [{name: 'Apdex'}]
  ]

  for (var i = 0; i < expected.length; i++) {
    var metric = expected[i]
    expectedAll.push([{name: metric}])
    expectedAll.push([{name: metric, scope: 'WebTransaction/Hapi/GET/' + path}])
  }

  assertMetrics(metrics, expectedAll, true, false)
}
