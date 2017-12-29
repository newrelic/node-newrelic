'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper')
var http = require('http')
var NAMES = require('../../../lib/metrics/names')
var utils = require('../hapi/hapi-utils')

var agent
var server
var port

tap.test('Hapi segments', function(t) {
  t.autoend()

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    server = utils.getServer()
    done()
  })

  t.afterEach(function() {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('route handler is recorded as middleware', function(t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function myHandler() {
        return 'ok'
      }
    })

    runTest(t, function(segments, transaction) {
      utils.checkMetrics(t, transaction.metrics, [
        NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
      ])
      utils.checkSegments(t, transaction.trace.root.children[0], [
        NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
      ])
      t.end()
    })
  })

  t.test('custom handler type is recorded as middleware', function(t) {
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
      utils.checkMetrics(t, transaction.metrics, [
        NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
      ])
      utils.checkSegments(t, transaction.trace.root.children[0], [
        NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
      ])
      t.end()
    })
  })

  t.test('extensions are recorded as middleware', function(t) {
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
      utils.checkMetrics(t, transaction.metrics, [
        NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
        NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
      ])
      utils.checkSegments(t, transaction.trace.root.children[0], [
        NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
        NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
      ])
      t.end()
    })
  })

  t.test('custom route handler and extension recorded as middleware', function(t) {
    server.ext('onRequest', function(req, h) {
      return h.continue
    })

    server.decorate('handler', 'customHandler', function(route, options) {
      return function customHandler() {
        return options.key1
      }
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: { customHandler: { key1: 'val1'} }
    })

    runTest(t, function(segments, transaction) {
      utils.checkMetrics(t, transaction.metrics, [
        NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
        NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
      ])
      utils.checkSegments(t, transaction.trace.root.children[0], [
        NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
        NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
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
    port = server.info.port
    makeRequest(server, 'http://localhost:' + port + '/test', function(response) {
      response.resume()
    })
  })
}

function makeRequest(server, path, callback) {
  http.request({port: port, path: path}, callback).end()
}
