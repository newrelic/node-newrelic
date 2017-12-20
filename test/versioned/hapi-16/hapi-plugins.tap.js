'use strict'

var semver = require('semver')
if (semver.satisfies(process.version, '<4.0')) {
  return
}

var helper = require('../../lib/agent_helper')
var request = require('request')
var tap = require('tap')

tap.test('Hapi Plugins', function(t) {
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
    t.plan(3)

    function plugin(srvr, opts, next) {
      srvr.route({
        method : 'GET',
        path   : '/test',
        handler : function myHandler(req, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
          reply('hello')
        }
      })
      next()
    }
    plugin.attributes = {name: 'foobar'}
    server.register(plugin)

    agent.on('transactionFinished', function(tx) {
      t.equal(
        tx.getFullName(), 'WebTransaction/Hapi/GET//test',
        'should name transaction correctly'
      )
    })

    server.start(function() {
      request.get('http://localhost:8089/test', function(error, res, body) {
        t.equal(body, 'hello', 'should not interfere with response')
      })
    })
  })

  t.test('maintains transaction state while mounting array of plugins', function(t) {
    t.plan(3)
    var plugin = {
      register: function plugin(srvr, opts, next) {
        srvr.route({
          method : 'GET',
          path   : '/test',
          handler : function myHandler(req, reply) {
          t.ok(agent.getTransaction(), 'transaction is available')
            reply('hello')
          }
        })
        next()
      }
    }
    plugin.register.attributes = { name: 'foo' }
    server.register([ plugin ])

    agent.on('transactionFinished', function(tx) {
      t.equal(
        tx.getFullName(), 'WebTransaction/Hapi/GET//test',
        'should name transaction correctly'
      )
    })

    server.start(function() {
      request.get('http://localhost:8089/test', function(error, res, body) {
        t.equal(body, 'hello', 'should not interfere with response')
      })
    })
  })
})
