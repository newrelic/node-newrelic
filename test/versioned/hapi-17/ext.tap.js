'use strict'

var request = require('request')
var tap = require('tap')
var helper = require('../../lib/agent_helper')
var utils = require('./hapi-17-utils')

tap.test('Hapi v17 ext', function(t) {
  t.autoend()

  var agent
  var server
  var port

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
    server = utils.getServer()
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
      port = server.info.port
      request.get('http://localhost:' + port + '/test', function() {
        t.end()
      })
    })
  })
})
