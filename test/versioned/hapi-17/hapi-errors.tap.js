'use strict'

var helper = require('../../lib/agent_helper')
var http = require('http')
var tap = require('tap')
var conditions = require('./conditions')

var TEST_PORT = 8089
var TEST_HOST = 'localhost'

var hapi
var agent
var server

tap.test('does not report error when handler returns a string', conditions, function(t) {
  setup(t)

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

tap.test('reports error when an instance of Error is returned', conditions, function(t) {
  setup(t)

  server.route({
    method: 'GET',
    path: '/test',
    handler: function() {
      return Promise.reject(new Error('rejected promise error'))
    }
  })

  runTest(t, function(errors, statusCode) {
    t.equals(errors.length, 1, 'should have one error')
    t.equals(errors[0][2], 'rejected promise error', 'should have expected error message')
    t.equals(statusCode, 500, 'should have expected error code')
    t.end()
  })
})

tap.test('reports error when thrown from a route', conditions, function(t) {
  setup(t)

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

tap.test('reports error when thrown from a middleware', conditions, function(t) {
  setup(t)

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

function setup(t) {
  agent = helper.instrumentMockedAgent()
  hapi = require('hapi')
  server = new hapi.Server({
    host: TEST_HOST,
    port: TEST_PORT
  })

  t.tearDown(function() {
    helper.unloadAgent(agent)
  })
}

function runTest(t, callback) {
  var statusCode
  var errors

  agent.on('transactionFinished', function() {
    errors = agent.errors.errors
    if (statusCode) {
      callback(errors, statusCode)
    }
  })

  var endpoint = '/test'
  server.start().then(function() {
    makeRequest(server, endpoint, function(response) {
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

function makeRequest(server, path, callback) {
  var port = TEST_PORT
  http.request({port: port, path: path}, callback).end()
}
