/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')

const helper = require('../../lib/agent_helper')
const utils = require('./hapi-utils')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  ctx.nr.server = utils.getServer()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.stop()
})

test('maintains transaction state', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const { agent, server } = t.nr

  const plugin = {
    register: function (srvr) {
      srvr.route({
        method: 'GET',
        path: '/test',
        handler: function myHandler() {
          plan.ok(agent.getTransaction(), 'transaction is available')
          return Promise.resolve('hello')
        }
      })
    },
    name: 'foobar'
  }

  agent.on('transactionFinished', function (tx) {
    plan.equal(
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
      const port = server.info.port
      helper.makeGetRequest(
        'http://localhost:' + port + '/test',
        {},
        function (_error, _res, body) {
          plan.equal(body, 'hello', 'should not interfere with response')
        }
      )
    })

  await plan.completed
})

test('includes route prefix in transaction name', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const { agent, server } = t.nr

  const plugin = {
    register: function (srvr) {
      srvr.route({
        method: 'GET',
        path: '/test',
        handler: function myHandler() {
          plan.ok(agent.getTransaction(), 'transaction is available')
          return Promise.resolve('hello')
        }
      })
    },
    name: 'foobar'
  }

  agent.on('transactionFinished', function (tx) {
    plan.equal(
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
      const port = server.info.port
      helper.makeGetRequest(
        'http://localhost:' + port + '/prefix/test',
        {},
        function (_error, _res, body) {
          plan.equal(body, 'hello', 'should not interfere with response')
        }
      )
    })

  await plan.completed
})
