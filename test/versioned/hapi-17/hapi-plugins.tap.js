'use strict'
// process.exit(0) // TODO failing

var helper = require('../../lib/agent_helper')
var request = require('request')
var tap = require('tap')
var conditions = require('./conditions')

tap.test('Hapi Plugins', conditions, function(t) {
  t.autoend()

  var hapi = null
  var agent = null
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
    server = new hapi.Server({ port: 8089 })
    done()
  })

  t.afterEach(function() {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('maintains transaction state', function(t) {
    t.plan(3)

    var plugin = {
      register: function(srvr) {
        srvr.route({
          method: 'GET',
          path: '/test',
          handler: function myHandler() {
            t.ok(agent.getTransaction(), 'transaction is available')
            return Promise.resolve('hello')
          }
        })
      },
      name: 'foobar'
    }

    agent.on('transactionFinished', function(tx) {
      t.equal(
        tx.getFullName(), 'WebTransaction/Hapi/GET//test',
        'should name transaction correctly'
      )
    })

    server.register(plugin)
      .then(function() {
        return server.start()
      })
      .then(function() {
        request.get('http://localhost:8089/test', function(error, res, body) {
          t.equal(body, 'hello', 'should not interfere with response')
        })
      })
  })
})
