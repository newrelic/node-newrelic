'use strict'

var request = require('request')
var test = require('tap').test
var helper = require('../../lib/agent_helper')
var conditions = require('./conditions')

test('Hapi.ext', conditions, function(t) {
  t.autoend()

  var hapi
  var agent
  var server

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
    server = new hapi.Server({port: 8089})
    done()
  })

  t.afterEach(function() {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('maintains transaction state', function(t) {
    server.ext('onRequest', function(req, h) {
      t.ok(agent.getTransaction(), 'transaction is available in onRequest handler')
      return new Promise (function(resolve) {
        tasks.push(function() {
          resolve(h.continue)
        })
      })
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: function myHandler() {
        t.ok(agent.getTransaction(), 'transaction is available in route handler')
        return 'ok'
      }
    })

    server.start().then(function() {
      request.get('http://localhost:8089/test', function() {
        t.end()
      })
    })
  })
})
