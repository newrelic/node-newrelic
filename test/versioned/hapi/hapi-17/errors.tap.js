'use strict'

var helper = require('../../../lib/agent_helper')
var http = require('http')
var tap = require('tap')
var utils = require('./hapi-17-utils')

var agent
var server
var port

tap.test('Hapi v17 error handling', function(t) {
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

  t.test('does not report error when handler returns a string', function(t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function() {
        return 'ok'
      }
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 0, 'should have no errors')
      t.equals(statusCode, 200, 'should have a 200 status code')
      t.end()
    })
  })

  t.test('reports error when an instance of Error is returned', function(t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function() {
        return Promise.reject(new Error('rejected promise error'))
      }
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 1, 'should have one error')

      t.equals(
        errors[0][2],
        'rejected promise error',
        'should have expected error message'
      )

      t.equals(statusCode, 500, 'should have expected error code')
      t.end()
    })
  })

  t.test('reports error when thrown from a route', function(t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function() {
        throw new Error('thrown error')
      }
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 1, 'should have one error')
      t.equals(errors[0][2], 'thrown error', 'should have expected error message')
      t.equals(statusCode, 500, 'should have expected error code')
      t.end()
    })
  })

  t.test('reports error when thrown from a middleware', function(t) {
    server.ext('onRequest', function() {
      throw new Error('middleware error')
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: function() {
        return 'ok'
      }
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 1, 'should have one error')
      t.equals(errors[0][2], 'middleware error', 'should have expected error message')
      t.equals(statusCode, 500, 'should have expected error code')
      t.end()
    })
  })

  t.test('reports error when error handler replies with transformed error', (t) => {
    server.ext('onPreResponse', (req) => {
      t.ok(req.response instanceof Error, 'preResponse has error')
      req.response.output.statusCode = 400
      return req.response
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: () =>  {
        throw new Error('route handler error')
      }
    })

    runTest(t, (errors, statusCode) => {
      t.equals(errors.length, 1, 'has 1 reported error')
      t.equals(errors[0][2], 'route handler error', 'has correct error message')
      t.equals(statusCode, 400, 'has expected 400 status code')
      t.end()
    })
  })

  t.test('reports error when error handler continues with transformed response', (t) => {
    server.ext('onPreResponse', (req, h) => {
      t.ok(req.response instanceof Error, 'preResponse has error')
      req.response.output.statusCode = 400
      return h.continue
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: () =>  {
        throw new Error('route handler error')
      }
    })

    runTest(t, (errors, statusCode) => {
      t.equals(errors.length, 1, 'has 1 reported error')
      t.equals(errors[0][2], 'route handler error', 'has correct error message')
      t.equals(statusCode, 400, 'has expected 400 status code')
      t.end()
    })
  })

  t.test('reports error when error handler continues with original response', (t) => {
    server.ext('onPreResponse', (req, h) => {
      t.ok(req.response instanceof Error, 'preResponse has error')
      return h.continue
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: () =>  {
        throw new Error('route handler error')
      }
    })

    runTest(t, (errors, statusCode) => {
      t.equals(errors.length, 1, 'has 1 reported error')
      t.equals(errors[0][2], 'route handler error', 'has correct error message')
      t.equals(statusCode, 500, 'has expected 500 status code')
      t.end()
    })
  })

  t.test('should not report error when error handler responds', (t) => {
    server.ext('onPreResponse', (req) => {
      t.ok(req.response.isBoom, 'preResponse has error')
      return null
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: () => {
        throw new Error('route handler error')
      }
    })

    runTest(t, (errors, statusCode) => {
      t.equals(errors.length, 0, 'has no reported errors')
      t.equals(statusCode, 200, 'has expected 200 status')
      t.end()
    })
  })
})

function runTest(t, callback) {
  var statusCode
  var errors

  agent.on('transactionFinished', function() {
    errors = agent.errors.traceAggregator.errors
    if (statusCode) {
      callback(errors, statusCode)
    }
  })

  var endpoint = '/test'
  server.start().then(function() {
    port = server.info.port
    makeRequest(endpoint, function(response) {
      statusCode = response.statusCode
      if (errors) {
        callback(errors, statusCode)
      }
      response.resume()
    })
  })
  t.tearDown(function() {
    server.stop()
  })
}

function makeRequest(path, callback) {
  http.request({port: port, path: path}, callback).end()
}
