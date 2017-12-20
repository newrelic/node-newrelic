'use strict'

// hapi 10.x and higher works on Node 4 and higher
var semver = require('semver')
if (semver.satisfies(process.versions.node, '<4.0')) return

var request = require('request')
var test = require('tap').test
var helper = require('../../lib/agent_helper')


test("Hapi.ext", function(t) {
  t.autoend()

  var agent = null
  var hapi = null
  var server = null

  // queue that executes outside of a transaction context
  var tasks = []
  var intervalId = setInterval(function() {
    while (tasks.length) {
      var task = tasks.pop()
      task()
    }
  }, 10)

  t.tearDown(function() {
    clearInterval(intervalId)
  })

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    hapi = require('hapi')
    server = new hapi.Server()
    server.connection({port: 8089})
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    server.stop(done)
  })

  t.test('maintains transaction state', function(t) {
    server.ext('onRequest', function(request, reply) {
      t.ok(agent.getTransaction(), "transaction is available")
      tasks.push(function() {
        reply.continue()
      })
    })

    server.route({
      method : 'GET',
      path   : '/test',
      handler : function myHandler(request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")
        reply()
      }
    })

    server.start(function() {
      request.get('http://localhost:8089/test', function() {
        t.end()
      })
    })
  })

  t.test('maintains transaction state, with config object', function(t) {
    var config = {
      type: 'onRequest',
      method: function(request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")
        tasks.push(function() {
          reply.continue()
        })
      }
    }
    server.ext(config)

    server.route({
      method: 'GET',
      path: '/test',
      handler: function myHandler(request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")
        reply()
      }
    })

    server.start(function() {
      request.get('http://localhost:8089/test', function() {
        t.end()
      })
    })
  })

  t.test('maintains transaction state, with array of config objects', function(t) {
    var config = [
      {
        type: 'onRequest',
        method: function(request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")
          tasks.push(function() {
            reply.continue()
          })
        }
      }
    ]
    server.ext(config)

    server.route({
      method: 'GET',
      path: '/test',
      handler: function myHandler(request, reply) {
      t.ok(agent.getTransaction(), "transaction is available")
        reply()
      }
    })

    server.start(function() {
      request.get('http://localhost:8089/test', function() {
        t.end()
      })
    })
  })
})
