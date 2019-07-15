'use strict'

var helper = require('../../../lib/agent_helper')
var request = require('request')
var tap = require('tap')
var utils = require('./hapi-18-utils')

tap.test('Hapi Plugins', function(t) {
  t.autoend()

  var agent = null
  var server = null
  var port = null

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
        port = server.info.port
        request.get('http://localhost:' + port + '/test', function(error, res, body) {
          t.equal(body, 'hello', 'should not interfere with response')
        })
      })
  })

  t.test('includes route prefix in transaction name', function(t) {
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
        tx.getFullName(), 'WebTransaction/Hapi/GET//prefix/test',
        'should name transaction correctly'
      )
    })

    server.register(plugin, {routes: { prefix: '/prefix' }})
      .then(function() {
        return server.start()
      })
      .then(function() {
        port = server.info.port
        request.get('http://localhost:' + port + '/prefix/test', function(error, res, body) {
          t.equal(body, 'hello', 'should not interfere with response')
        })
      })
  })
})
