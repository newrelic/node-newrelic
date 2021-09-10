/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../../lib/agent_helper')
const request = require('request')
const tap = require('tap')
const utils = require('./hapi-18-utils')

tap.test('Hapi Plugins', function (t) {
  t.autoend()

  let agent = null
  let server = null
  let port = null

  // queue that executes outside of a transaction context
  const tasks = []
  const intervalId = setInterval(function () {
    while (tasks.length) {
      const task = tasks.pop()
      task()
    }
  }, 10)

  t.teardown(function () {
    clearInterval(intervalId)
  })

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent()

    server = utils.getServer()
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('maintains transaction state', function (t) {
    t.plan(3)

    const plugin = {
      register: function (srvr) {
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

    agent.on('transactionFinished', function (tx) {
      t.equal(
        tx.getFullName(),
        'WebTransaction/Hapi/GET//test',
        'should name transaction correctly'
      )
    })

    server
      .register(plugin)
      .then(function () {
        return server.start()
      })
      .then(function () {
        port = server.info.port
        request.get('http://localhost:' + port + '/test', function (error, res, body) {
          t.equal(body, 'hello', 'should not interfere with response')
        })
      })
  })

  t.test('includes route prefix in transaction name', function (t) {
    t.plan(3)

    const plugin = {
      register: function (srvr) {
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

    agent.on('transactionFinished', function (tx) {
      t.equal(
        tx.getFullName(),
        'WebTransaction/Hapi/GET//prefix/test',
        'should name transaction correctly'
      )
    })

    server
      .register(plugin, { routes: { prefix: '/prefix' } })
      .then(function () {
        return server.start()
      })
      .then(function () {
        port = server.info.port
        request.get('http://localhost:' + port + '/prefix/test', function (error, res, body) {
          t.equal(body, 'hello', 'should not interfere with response')
        })
      })
  })
})
