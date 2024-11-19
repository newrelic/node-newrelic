/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const { runTest } = require('./common')

test('Restify transaction naming', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.instrumentMockedAgent()
    const restify = require('restify')
    const server = restify.createServer()
    ctx.nr = {
      agent,
      restify,
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

  await t.test('transaction name with single route', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    server.get('/path1', (req, res, next) => {
      res.send()
      next()
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('transaction name with async response middleware', async (t) => {
    const { agent, restify, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    // restify v5 added the plugins object
    if (restify.plugins && restify.plugins.gzipResponse) {
      server.use(restify.plugins.gzipResponse())
    } else {
      server.use(restify.gzipResponse())
    }

    server.get('/path1', (req, res, next) => {
      res.send({
        patientId: 5,
        entries: ['hi', 'bye', 'example'],
        total: 3
      })
      next()
    })

    runTest({
      agent,
      server,
      assert: plan,
      endpoint: '/path1',
      expectedName: 'GET//path1',
      requestOpts: { headers: { 'Accept-Encoding': 'gzip' } }
    })
    await plan.completed
  })

  await t.test('transaction name with async response middleware (res.json)', async (t) => {
    const { agent, restify, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    // restify v5 added the plugins object
    if (restify.plugins && restify.plugins.gzipResponse) {
      server.use(restify.plugins.gzipResponse())
    } else {
      server.use(restify.gzipResponse())
    }

    server.get('/path1', (req, res, next) => {
      res.json({
        patientId: 5,
        entries: ['hi', 'bye', 'example'],
        total: 3
      })
      next()
    })

    runTest({
      agent,
      server,
      assert: plan,
      endpoint: '/path1',
      expectedName: 'GET//path1',
      requestOpts: { headers: { 'Accept-Encoding': 'gzip' } }
    })

    await plan.completed
  })

  await t.test('transaction name with async response middleware (res.sendRaw)', async (t) => {
    const { agent, restify, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    // restify v5 added the plugins object
    if (restify.plugins && restify.plugins.gzipResponse) {
      server.use(restify.plugins.gzipResponse())
    } else {
      server.use(restify.gzipResponse())
    }

    server.get('/path1', (req, res, next) => {
      res.sendRaw(
        JSON.stringify({
          patientId: 5,
          entries: ['hi', 'bye', 'example'],
          total: 3
        })
      )
      next()
    })

    runTest({
      agent,
      server,
      assert: plan,
      endpoint: '/path1',
      expectedName: 'GET//path1',
      requestOpts: { headers: { 'Accept-Encoding': 'gzip' } }
    })

    await plan.completed
  })

  await t.test('transaction name with async response middleware (res.redirect)', async (t) => {
    const { agent, restify, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    // restify v5 added the plugins object
    if (restify.plugins && restify.plugins.gzipResponse) {
      server.use(restify.plugins.gzipResponse())
    } else {
      server.use(restify.gzipResponse())
    }

    server.get('/path1', (req, res, next) => {
      res.redirect('http://google.com', next)
    })

    runTest({
      agent,
      server,
      assert: plan,
      endpoint: '/path1',
      expectedName: 'GET//path1',
      requestOpts: { headers: { 'Accept-Encoding': 'gzip' } }
    })

    await plan.completed
  })

  await t.test('transaction name with no matched routes', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    server.get('/path1', (req, res, next) => {
      plan.ok(0, 'should not enter different endpoint')
      res.send()
      next()
    })

    runTest({
      agent,
      server,
      assert: plan,
      endpoint: '/foobar',
      prefix: 'Nodejs',
      expectedName: 'GET/(not found)'
    })
    await plan.completed
  })

  await t.test('transaction name contains trailing slash', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 2 })

    server.get('/path/', (req, res, next) => {
      plan.ok(1, 'should enter route')
      res.send()
      next()
    })

    runTest({ agent, server, assert: plan, endpoint: '/path/', expectedName: 'GET//path/' })
    await plan.completed
  })

  await t.test('transaction name does not contain trailing slash', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 2 })
    server.get('/path', (req, res, next) => {
      plan.ok(1, 'should enter route')
      res.send()
      next()
    })

    runTest({ agent, server, assert: plan, endpoint: '/path', expectedName: 'GET//path' })
    await plan.completed
  })

  await t.test('transaction name with route that has multiple handlers', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 3 })

    server.get(
      '/path1',
      (req, res, next) => {
        plan.ok(1, 'should enter first middleware')
        next()
      },
      (req, res, next) => {
        plan.ok(1, 'should enter second middleware')
        res.send()
        next()
      }
    )

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('transaction name with middleware', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 3 })

    server.use((req, res, next) => {
      plan.ok(1, 'should enter `use` middleware')
      next()
    })
    server.get('/path1', (req, res, next) => {
      plan.ok(1, 'should enter route handler')
      res.send()
      next()
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('with error', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    const errors = require('restify-errors')

    server.get('/path1', (req, res, next) => {
      next(new errors.InternalServerError('foobar'))
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('with error while out of context', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    const errors = require('restify-errors')

    server.get('/path1', (req, res, next) => {
      helper.runOutOfContext(() => {
        next(new errors.InternalServerError('foobar'))
      })
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('when using a route variable', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 2 })

    server.get('/foo/:bar', (req, res, next) => {
      plan.equal(req.params.bar, 'fizz', 'should pass through params')
      res.send()
      next()
    })

    runTest({ agent, server, assert: plan, endpoint: '/foo/fizz', expectedName: 'GET//foo/:bar' })
    await plan.completed
  })

  await t.test('when using a regular expression in path', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 2 })

    server.get('/foo/*', (req, res, next) => {
      plan.equal(req.params['*'], 'bar', 'should pass through captured param')
      res.send()
      next()
    })

    runTest({ agent, server, assert: plan, endpoint: '/foo/bar', expectedName: 'GET//foo/*' })
    await plan.completed
  })

  await t.test('when next is called after transaction state loss', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 5 })

    server.use((req, res, next) => {
      plan.ok(agent.getTransaction(), 'should have transaction at start')
      req.testTx = agent.getTransaction()

      helper.runOutOfContext(() => {
        plan.ok(!agent.getTransaction(), 'should lose transaction before next')
        next()
      })
    })

    server.get('/path1', (req, res, next) => {
      const tx = agent.getTransaction()
      plan.ok(tx, 'should re-instate transaction in next middleware')
      plan.equal(tx && tx.id, req.testTx.id, 'should reinstate correct transaction')
      res.send()
      next()
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('responding after transaction state loss', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 2 })

    server.get('/path1', (req, res, next) => {
      helper.runOutOfContext(() => {
        plan.ok(!agent.getTransaction(), 'should have no transaction')
        res.send()
        next()
      })
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('responding with just a status code', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    server.get('/path1', (req, res, next) => {
      res.send(299)
      next()
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })

  await t.test('responding with just a status code after state loss', async (t) => {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 1 })

    server.get('/path1', (req, res, next) => {
      helper.runOutOfContext(() => {
        res.send(299)
        next()
      })
    })

    runTest({ agent, server, assert: plan, endpoint: '/path1', expectedName: 'GET//path1' })
    await plan.completed
  })
})
