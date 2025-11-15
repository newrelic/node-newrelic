/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const fakeCert = require('../../lib/fake-cert')
const helper = require('../../lib/agent_helper')
const { assertPackageMetrics, assertMetrics } = require('../../lib/custom-assertions')

const METRIC = 'WebTransaction/Restify/GET//hello/:name'

test('Restify', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.instrumentMockedAgent()
    const restify = require('restify')
    ctx.nr = {
      agent,
      restify
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should log tracking metrics', function(t) {
    const { agent } = t.nr
    const { version } = require('restify/package.json')
    assertPackageMetrics({ agent, pkg: 'restify', version })
  })

  await t.test('should not crash when handling a connection', async function (t) {
    const { agent, restify } = t.nr
    const plan = tspl(t, { plan: 8 })

    const server = restify.createServer()
    t.after(() => server.close())

    agent.on('transactionFinished', () => {
      const metric = agent.metrics.getMetric(METRIC)
      plan.ok(metric, 'request metrics should have been gathered')
      plan.equal(metric.callCount, 1, 'handler should have been called')
      const isFramework = agent.environment.get('Framework').indexOf('Restify') > -1
      plan.ok(isFramework, 'should indicate that restify is a framework')
    })

    server.get('/hello/:name', function sayHello(req, res, next) {
      plan.ok(agent.getTransaction(), 'transaction should be available in handler')
      res.send('hello ' + req.params.name)
      next()
    })

    server.listen(0, function () {
      const port = server.address().port
      plan.ok(!agent.getTransaction(), 'transaction should not leak into server')

      const url = 'http://localhost:' + port + '/hello/friend'
      helper.makeGetRequest(url, function (error, response, body) {
        plan.ok(!error)
        plan.ok(!agent.getTransaction(), 'transaction should not leak into external request')
        plan.equal(body, 'hello friend', 'should return expected data')
      })
    })

    await plan.completed
  })

  await t.test('should still be instrumented when run with SSL', async function (t) {
    const { agent, restify } = t.nr
    const plan = tspl(t, { plan: 8 })

    agent.on('transactionFinished', () => {
      const metric = agent.metrics.getMetric(METRIC)

      plan.ok(metric, 'request metrics should have been gathered')
      plan.equal(metric.callCount, 1, 'handler should have been called')

      const isFramework = agent.environment.get('Framework').indexOf('Restify') > -1
      plan.ok(isFramework, 'should indicate that restify is a framework')
    })

    const cert = fakeCert()

    const server = restify.createServer({ key: cert.privateKey, certificate: cert.certificate })
    t.after(() => server.close())

    server.get('/hello/:name', function sayHello(req, res, next) {
      plan.ok(agent.getTransaction(), 'transaction should be available in handler')
      res.send('hello ' + req.params.name)
      next()
    })

    server.listen(0, function () {
      const port = server.address().port
      plan.ok(!agent.getTransaction(), 'transaction should not leak into server')

      const url = `https://127.0.0.1:${port}/hello/friend`
      helper.makeGetRequest(url, { ca: cert.certificate }, function (error, response, body) {
        plan.ok(!error)
        plan.ok(!agent.getTransaction(), 'transaction should not leak into external request')
        plan.equal(body, 'hello friend', 'should return expected data')
      })
    })

    await plan.completed
  })

  await t.test('should generate middleware metrics', async (t) => {
    const { agent, restify } = t.nr
    const plan = tspl(t, { plan: 16 })
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

    server.use(function middleware(req, res, next) {
      plan.ok(agent.getTransaction(), 'should be in transaction context')
      next()
    })

    server.use(function middleware2(req, res, next) {
      plan.ok(agent.getTransaction(), 'should be in transaction context')
      next()
    })

    server.get('/foo/:bar', function handler(req, res, next) {
      plan.ok(agent.getTransaction(), 'should be in transaction context')
      res.send({ message: 'done' })
      next()
    })

    server.listen(0, function () {
      const port = server.address().port
      const url = `http://localhost:${port}/foo/bar`

      helper.makeGetRequest(url, function (error) {
        plan.ok(!error)
        assertMetrics(agent.metrics, expectedMiddlewareMetrics, false, false, { assert: plan })
      })
    })

    await plan.completed
  })
})
