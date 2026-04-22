/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const http = require('node:http')
const tspl = require('@matteo.collina/tspl')
const {
  assertMetrics,
  assertPackageMetrics,
  assertSegments
} = require('../../lib/custom-assertions')
const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')

// Connect logs stack traces if NODE_ENV is not set to "test"
process.env.NODE_ENV = 'test'

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  ctx.nr.connect = require('connect')
  ctx.nr.pkgVersion = require('connect/package').version
  ctx.nr.app = ctx.nr.connect()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['connect'])
})

test('should log tracking metrics', (t) => {
  const { agent, app, pkgVersion } = t.nr
  app.use('/foo', () => {})
  assertPackageMetrics({
    agent,
    pkg: 'connect',
    version: pkgVersion,
    subscriberType: true
  })
})

test('should properly name transaction from route name', async (t) => {
  const plan = tspl(t, { plan: 27 })
  const { agent, app } = t.nr

  agent.once('transactionFinished', (tx) => {
    plan.equal(tx.name, 'WebTransaction/Connect/GET//foo')
    plan.equal(tx.url, '/foo', 'URL is left alone')
    plan.equal(tx.verb, 'GET', 'HTTP method is GET')
    plan.equal(tx.statusCode, 200, 'status code is OK')
    plan.ok(tx.trace, 'transaction has trace')
    const [web] = tx.trace.getChildren(tx.trace.root.id)
    plan.ok(web, 'trace has web segment')
    plan.equal(web.name, tx.name, 'segment name and transaction name match')
    plan.equal(web.partialName, 'Connect/GET//foo', 'should have partial name for apdex')

    assertSegments(tx.trace, web, ['Nodejs/Middleware/Connect/middleware//foo'], { exact: true }, { assert: plan })
    const expectedMetrics = [
      [{ name: 'WebTransaction' }],
      [{ name: 'WebTransactionTotalTime' }],
      [{ name: 'HttpDispatcher' }],
      [{ name: 'WebTransaction/Connect/GET//foo' }],
      [{ name: 'WebTransactionTotalTime/Connect/GET//foo' }],
      [{ name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all' }],
      [{ name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/allWeb' }],
      [{ name: 'Apdex/Connect/GET//foo' }],
      [{ name: 'Apdex' }],
      [{ name: 'Nodejs/Middleware/Connect/middleware//foo' }],
      [{ name: 'Nodejs/Middleware/Connect/middleware//foo', scope: 'WebTransaction/Connect/GET//foo' }],
    ]
    assertMetrics(tx.metrics, expectedMetrics, false, false, { assert: plan })
  })

  function middleware(req, res) {
    plan.ok(agent.getTransaction(), 'transaction should be available')
    res.end('foo')
  }

  app.use('/foo', middleware)
  const server = createServerAndMakeRequest({
    url: '/foo',
    expectedData: 'foo',
    plan,
    app
  })
  t.after(() => server.close())

  await plan.completed
})

test('should default to `/` when no route is specified', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, app } = t.nr

  agent.once('transactionFinished', (tx) => {
    plan.equal(tx.name, 'WebTransaction/Connect/GET//')
    plan.equal(tx.url, '/foo', 'URL is left alone')
    plan.equal(tx.verb, 'GET', 'HTTP method is GET')
    plan.equal(tx.statusCode, 200, 'status code is OK')
    plan.ok(tx.trace, 'transaction has trace')
    const [web] = tx.trace.getChildren(tx.trace.root.id)
    plan.ok(web, 'trace has web segment')
    plan.equal(web.name, tx.name, 'segment name and transaction name match')
    plan.equal(web.partialName, 'Connect/GET//', 'should have partial name for apdex')
  })

  function middleware(req, res) {
    plan.ok(agent.getTransaction(), 'transaction should be available')
    res.end('root')
  }

  app.use(middleware)
  const server = createServerAndMakeRequest({
    url: '/foo',
    expectedData: 'root',
    plan,
    app
  })
  t.after(() => server.close())

  await plan.completed
})

/**
 * Sets up HTTP server and binds a connect instance.
 * It then makes a request to specified url and asserts the response
 * data is correct.
 *
 * @param {object} params params object
 * @param {string} params.url url to make request
 * @param {string} params.expectedData expected response data
 * @param {object} params.plan plan object
 * @param {object} params.app connect app
 * @returns {http.Server}
 */
function createServerAndMakeRequest({ url, expectedData, plan, app }) {
  const server = http.createServer(app).listen(0, function () {
    const req = http.request(
      {
        port: server.address().port,
        host: 'localhost',
        path: url,
        method: 'GET'
      },
      function onResponse(res) {
        res.on('data', function (data) {
          plan.equal(data.toString(), expectedData, 'should respond with proper data')
        })
      }
    )
    req.end()
  })

  return server
}
