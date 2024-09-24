/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { setup, teardown } = require('./utils')
const tsplan = require('@matteo.collina/tspl')

test('Express route param', async function (t) {
  t.beforeEach(async (ctx) => {
    await setup(ctx)
    createServer(ctx.nr)
  })

  t.afterEach(teardown)

  await t.test('pass-through param', async function (t) {
    const { agent, port } = t.nr
    const plan = tsplan(t, { plan: 4 })

    agent.once('transactionFinished', function (tx) {
      plan.equal(
        tx.name,
        'WebTransaction/Expressjs/GET//a/b/:action/c',
        'should have correct transaction name'
      )
    })

    testRequest(port, 'foo', function (err, body) {
      plan.ok(!err, 'should not have errored')
      plan.equal(body.action, 'foo', 'should pass through correct parameter value')
      plan.equal(body.name, 'action', 'should pass through correct parameter name')
    })
    await plan.completed
  })

  await t.test('respond from param', async function (t) {
    const { agent, port } = t.nr
    const plan = tsplan(t, { plan: 3 })

    agent.once('transactionFinished', function (tx) {
      plan.equal(
        tx.name,
        'WebTransaction/Expressjs/GET//a/[param handler :action]',
        'should have correct transaction name'
      )
    })

    testRequest(port, 'deny', function (err, body) {
      plan.ok(!err, 'should not have errored')
      plan.equal(body, 'denied', 'should have responded from within paramware')
    })
    await plan.completed
  })

  await t.test('in-active transaction in param handler', async function (t) {
    const { agent, port } = t.nr
    const plan = tsplan(t, { plan: 4 })

    agent.once('transactionFinished', function (tx) {
      plan.equal(
        tx.name,
        'WebTransaction/Expressjs/GET//a/b/preempt/c',
        'should have correct transaction name'
      )
    })

    testRequest(port, 'preempt', function (err, body) {
      plan.ok(!err, 'should not have errored')
      plan.equal(body.action, 'preempt', 'should pass through correct parameter value')
      plan.equal(body.name, 'action', 'should pass through correct parameter name')
    })
    await plan.completed
  })
})

function testRequest(port, param, cb) {
  const url = 'http://localhost:' + port + '/a/b/' + param + '/c'
  helper.makeGetRequest(url, function (err, _response, body) {
    cb(err, body)
  })
}

function createServer({ express, app }) {
  const aRouter = new express.Router()
  const bRouter = new express.Router()
  const cRouter = new express.Router()

  cRouter.get('', function (req, res) {
    if (req.action !== 'preempt') {
      res.json({ action: req.action, name: req.name })
    }
  })

  bRouter.use('/c', cRouter)

  aRouter.param('action', function (req, res, next, action, name) {
    req.action = action
    req.name = name
    if (action === 'deny') {
      res.status(200).json('denied')
    } else {
      next()
    }
  })

  aRouter.use('/b/:action', bRouter)
  app.use('/a/b/preempt/c', function (req, res, next) {
    res.send({ action: 'preempt', name: 'action' })
    process.nextTick(next)
  })
  app.use('/a', aRouter)
}
