/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')
const { removeModules } = require('../../lib/cache-buster')

test.beforeEach(async (ctx) => {
  ctx.nr = {}

  const agent = helper.instrumentMockedAgent()
  const server = require('fastify')({
    forceCloseConnections: true
  })

  server.route({
    method: 'GET',
    path: '/async-handler',
    async handler () {
      throw Error('async function error')
    }
  })

  server.route({
    method: 'GET',
    path: '/synchronous-handler',
    handler () {
      throw Error('synchronous function error')
    }
  })

  const address = await server.listen({ host: '127.0.0.1', port: 0 })

  ctx.nr.agent = agent
  ctx.nr.server = server
  ctx.nr.baseUrl = address
})

test.afterEach(async (ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  await ctx.nr.server.close()
  removeModules(['fastify'])
})

test('synchronous handler errors', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const { agent, baseUrl } = t.nr
  agent.on('transactionFinished', (tx) => {
    plan.equal(tx.exceptions.length, 1)
    plan.equal(tx.exceptions[0].error.message, 'synchronous function error')
  })

  const { body } = await helper.makeGetRequestAsync(`${baseUrl}/synchronous-handler`)
  plan.deepEqual(body, {
    error: 'Internal Server Error',
    message: 'synchronous function error',
    statusCode: 500
  })

  await plan.completed
})

test('asynchronous handler errors', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const { agent, baseUrl } = t.nr
  agent.on('transactionFinished', (tx) => {
    plan.equal(tx.exceptions.length, 1)
    plan.equal(tx.exceptions[0].error.message, 'async function error')
  })

  const { body } = await helper.makeGetRequestAsync(`${baseUrl}/async-handler`)
  plan.deepEqual(body, {
    error: 'Internal Server Error',
    message: 'async function error',
    statusCode: 500
  })

  await plan.completed
})
