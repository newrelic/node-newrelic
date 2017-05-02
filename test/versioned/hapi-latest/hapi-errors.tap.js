'use strict'

// hapi 10.x and higher works on Node 4 and higher
var semver = require('semver')
if (semver.satisfies(process.versions.node, '<4.0')) return

var helper = require('../../lib/agent_helper.js')
var http = require('http')
var test = require('tap').test

var TEST_PORT = 8089
var TEST_HOST = 'localhost'

var hapi
var agent
var server

test('does not report error when reply is called with a string', function(t) {
  setup(t)

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

test('reports error when reply is called with an instance of Error', function(t) {
  setup(t)

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

test('reports error when thrown from a route', function(t) {
  setup(t)

  server.route({
    method: 'GET',
    path: '/test',
    handler: function(request, reply) {
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

test('reports error when thrown from a middleware', function(t) {
  setup(t)

  server.ext('onRequest', function(request, reply) {
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

function runTest(t, callback) {
  var statusCode
  var errors

  agent.on('transactionFinished', function(tx) {
    errors = agent.errors.errors
    if (statusCode) {
      callback(errors, statusCode)
    }
  })

  var endpoint = '/test'
  server.start(function(){
    makeRequest(server, endpoint, function(response) {
      statusCode = response.statusCode
      if (errors) {
        callback(errors, statusCode)
      }
      response.resume()
    })
  })
  t.tearDown(function cb_tearDown() {
    server.stop()
  })
}

function makeRequest(server, path, callback) {
  var port = TEST_PORT
  http.request({port: port, path: path}, callback).end()
}
