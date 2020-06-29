/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var helper = require('../../../lib/agent_helper')
var request = require('request')
var tap = require('tap')
var utils = require('./hapi-utils')

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

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    server.stop(done)
  })

  t.test('maintains transaction state', function(t) {
    t.plan(3)

    function plugin(srvr, opts, next) {
      srvr.route({
        method: 'GET',
        path: '/test',
        handler: function myHandler(req, reply) {
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
      port = server.info.port
      request.get('http://localhost:' + port + '/test', function(error, res, body) {
        t.equal(body, 'hello', 'should not interfere with response')
      })
    })
  })

  t.test('includes route prefix in transaction name', function(t) {
    t.plan(3)

    function plugin(srvr, opts, next) {
      srvr.route({
        method: 'GET',
        path: '/test',
        handler: function myHandler(req, reply) {
          t.ok(agent.getTransaction(), 'transaction is available')
          reply('hello')
        }
      })
      next()
    }
    plugin.attributes = {name: 'foobar'}
    server.register(plugin, { routes: { prefix: '/prefix' } })

    agent.on('transactionFinished', function(tx) {
      t.equal(
        tx.getFullName(), 'WebTransaction/Hapi/GET//prefix/test',
        'should name transaction correctly'
      )
    })

    server.start(function() {
      port = server.info.port
      request.get('http://localhost:' + port + '/prefix/test', function(error, res, body) {
        t.equal(body, 'hello', 'should not interfere with response')
      })
    })
  })

  t.test('maintains transaction state while mounting array of plugins', function(t) {
    t.plan(3)
    var plugin = {
      register: function plugin(srvr, opts, next) {
        srvr.route({
          method: 'GET',
          path: '/test',
          handler: function myHandler(req, reply) {
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
      port = server.info.port
      request.get('http://localhost:' + port + '/test', function(error, res, body) {
        t.equal(body, 'hello', 'should not interfere with response')
      })
    })
  })
})
