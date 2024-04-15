/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')
require('../../lib/metrics_helper')
const { runTest } = require('./common')

const simulateAsyncWork = async () => {
  const delay = Math.floor(Math.random() * 100)
  await new Promise((resolve) => setTimeout(resolve, delay))
  return delay
}

tap.test('Restify with async handlers should work the same as with sync', (t) => {
  t.autoend()

  let agent = null
  let restify = null
  let server = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()

    restify = require('restify')
    server = restify.createServer()
  })

  t.afterEach(() => {
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

  t.test('transaction name for single async route', (t) => {
    t.plan(1)

    server.get('/path1', async (req, res) => {
      res.send()
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('transaction name for async route with sync middleware', (t) => {
    t.plan(1)

    server.use((req, res, next) => {
      next()
    })
    server.get('/path1', async (req, res) => {
      res.send()
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('transaction name for async route with async middleware', (t) => {
    t.plan(1)

    server.use(async (req) => {
      req.test = await simulateAsyncWork()
    })
    server.get('/path1', async (req, res) => {
      res.send()
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('transaction name for async route with multiple async middleware', (t) => {
    t.plan(4)

    server.use(async (req) => {
      t.pass('should enter first `use` middleware')
      req.test = await simulateAsyncWork()
    })
    // eslint-disable-next-line no-unused-vars
    server.use(async (req) => {
      t.pass('should enter second `use` middleware')
      req.test2 = await simulateAsyncWork()
    })
    server.get('/path1', async (req, res) => {
      t.pass('should enter route handler')
      res.send()
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })
})

tap.test('Restify metrics for async handlers', (t) => {
  t.autoend()

  let agent = null
  let restify = null
  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()

    restify = require('restify')
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should generate middleware metrics for async handlers', (t) => {
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
    t.teardown(() => server.close())

    server.use(async function middleware() {
      t.ok(agent.getTransaction(), 'should be in transaction context')
    })

    server.use(async function middleware2() {
      t.ok(agent.getTransaction(), 'should be in transaction context')
    })

    server.get('/foo/:bar', async function handler(req, res) {
      t.ok(agent.getTransaction(), 'should be in transaction context')
      res.send({ message: 'done' })
    })

    server.listen(0, function () {
      const port = server.address().port
      const url = `http://localhost:${port}/foo/bar`

      helper.makeGetRequest(url, function (error) {
        t.error(error)

        t.assertMetrics(agent.metrics, expectedMiddlewareMetrics, false, false)
        t.end()
      })
    })
  })
})
