/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const { runTest } = require('./common')
const { tspl } = require('@matteo.collina/tspl')
const { assertMetrics } = require('../../lib/custom-assertions')

const simulateAsyncWork = async () => {
  const delay = Math.floor(Math.random() * 100)
  await new Promise((resolve) => setTimeout(resolve, delay))
  return delay
}

test('Restify with async handlers should work the same as with sync', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.instrumentMockedAgent()
    const restify = require('restify')
    const server = restify.createServer()
    ctx.nr = {
      agent,
      server
    }
  })

  t.afterEach((ctx) => {
    const { agent, server } = ctx.nr
    return new Promise((resolve) => {
      helper.unloadAgent(agent)
      if (server) {
        server.close(resolve)
      } else {
        resolve()
      }
    })
  })

  /* very similar synchronous tests are in transaction-naming */

  await t.test('transaction name for single async route', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    server.get('/path1', async (req, res) => {
      res.send()
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('transaction name for async route with sync middleware', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    server.use((req, res, next) => {
      next()
    })
    server.get('/path1', async (req, res) => {
      res.send()
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('transaction name for async route with async middleware', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    server.use(async (req) => {
      req.test = await simulateAsyncWork()
    })
    server.get('/path1', async (req, res) => {
      res.send()
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('transaction name for async route with multiple async middleware', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 4 })

    server.use(async (req) => {
      plan.ok(1, 'should enter first `use` middleware')
      req.test = await simulateAsyncWork()
    })
    // eslint-disable-next-line no-unused-vars
    server.use(async (req) => {
      plan.ok(1, 'should enter second `use` middleware')
      req.test2 = await simulateAsyncWork()
    })
    server.get('/path1', async (req, res) => {
      plan.ok(1, 'should enter route handler')
      res.send()
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })
})

test('Restify metrics for async handlers', async (t) => {
  const agent = helper.instrumentMockedAgent()
  const restify = require('restify')

  t.after(() => {
    helper.unloadAgent(agent)
  })

  await t.test('should generate middleware metrics for async handlers', (t, end) => {
    // Metrics for this transaction with the right name.
    const expectedMiddlewareMetrics = [
      [{ name: 'WebTransaction/Restify/GET//foo/:bar' }],
      [{ name: 'WebTransactionTotalTime/Restify/GET//foo/:bar' }],
      [{ name: 'Apdex/Restify/GET//foo/:bar' }],

      // Unscoped middleware metrics.
      [{ name: 'Nodejs/Middleware/Restify/middleware//' }],
      [{ name: 'Nodejs/Middleware/Restify/middleware2//' }],
      [{ name: 'Nodejs/Middleware/Restify/handler//foo/:bar' }],

      // Scoped middleware metrics.
      [
        {
          name: 'Nodejs/Middleware/Restify/middleware//',
          scope: 'WebTransaction/Restify/GET//foo/:bar'
        }
      ],
      [
        {
          name: 'Nodejs/Middleware/Restify/middleware2//',
          scope: 'WebTransaction/Restify/GET//foo/:bar'
        }
      ],
      [
        {
          name: 'Nodejs/Middleware/Restify/handler//foo/:bar',
          scope: 'WebTransaction/Restify/GET//foo/:bar'
        }
      ]
    ]

    const server = restify.createServer()
    t.after(() => server.close())

    server.use(async function middleware() {
      assert.ok(agent.getTransaction(), 'should be in transaction context')
    })

    server.use(async function middleware2() {
      assert.ok(agent.getTransaction(), 'should be in transaction context')
    })

    server.get('/foo/:bar', async function handler(req, res) {
      assert.ok(agent.getTransaction(), 'should be in transaction context')
      res.send({ message: 'done' })
    })

    server.listen(0, function () {
      const port = server.address().port
      const url = `http://localhost:${port}/foo/bar`

      helper.makeGetRequest(url, function (error) {
        assert.ok(!error)

        assertMetrics(agent.metrics, expectedMiddlewareMetrics, false, false)
        end()
      })
    })
  })
})
