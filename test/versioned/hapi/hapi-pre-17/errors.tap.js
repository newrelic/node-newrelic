'use strict'

var helper = require('../../../lib/agent_helper')
var http = require('http')
var tap = require('tap')
var utils = require('./hapi-utils')

var agent
var server
var port

tap.test('Hapi v16 error handling', function(t) {
  t.autoend()

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    server = utils.getServer()
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    server.stop(done)
  })

  t.test('does not report error when reply is called with a string', function(t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function(request, reply) {
        reply('ok')
      }
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 0)
      t.equals(statusCode, 200)
      t.end()
    })
  })

  t.test('reports error when reply is called with an instance of Error', function(t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function(request, reply) {
        reply(new Error('some error'))
      }
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 1)
      t.equals(errors[0][2], 'some error')
      t.equals(statusCode, 500)
      t.end()
    })
  })

  t.test('reports error when thrown from a route', function(t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function() {
        throw new Error('some error')
      }
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 1)
      t.equals(errors[0][2], 'Uncaught error: some error')
      t.equals(statusCode, 500)
      t.end()
    })
  })

  t.test('reports error when thrown from a middleware', function(t) {
    server.ext('onRequest', function() {
      throw new Error('some error')
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: function(request, reply) {
        reply('ok')
      }
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 1)
      t.equals(errors[0][2], 'Uncaught error: some error')
      t.equals(statusCode, 500)
      t.end()
    })
  })
})

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
  server.start(function() {
    port = server.info.port
    makeRequest(server, endpoint, function(response) {
      statusCode = response.statusCode
      if (errors) {
        callback(errors, statusCode)
      }
      response.resume()
    })
  })
}

function makeRequest(server, path, callback) {
  http.request({port: port, path: path}, callback).end()
}
