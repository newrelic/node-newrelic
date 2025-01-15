/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { setup, teardown } = require('./utils')
const tsplan = require('@matteo.collina/tspl')

test.beforeEach(async (ctx) => {
  await setup(ctx, {
    attributes: {
      enabled: true,
      include: ['request.parameters.*']
    }
  })
})

test.afterEach(teardown)

test('Express router introspection', async function (t) {
  const { agent, app, express, port } = t.nr
  const plan = tsplan(t, { plan: 14 })

  const router = express.Router()
  router.get('/b/:param2', function (req, res) {
    plan.ok(agent.getTransaction(), 'transaction is available')

    res.send({ status: 'ok' })
    res.end()
  })
  app.use('/a/:param1', router)

  agent.on('transactionFinished', function (transaction) {
    plan.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET//a/:param1/b/:param2',
      'transaction has expected name'
    )

    plan.equal(transaction.url, '/a/foo/b/bar', 'URL is left alone')
    plan.equal(transaction.statusCode, 200, 'status code is OK')
    plan.equal(transaction.verb, 'GET', 'HTTP method is GET')
    plan.ok(transaction.trace, 'transaction has trace')

    const [web] = transaction.trace.getChildren(transaction.trace.root.id)
    plan.ok(web, 'trace has web segment')
    plan.equal(web.name, transaction.name, 'segment name and transaction name match')
    plan.equal(
      web.partialName,
      'Expressjs/GET//a/:param1/b/:param2',
      'should have partial name for apdex'
    )
    const attributes = web.getAttributes()
    plan.equal(attributes['request.parameters.route.param1'], 'foo', 'should have param1')
    plan.equal(attributes['request.parameters.route.param2'], 'bar', 'should have param2')
  })

  const url = 'http://localhost:' + port + '/a/foo/b/bar'
  helper.makeGetRequest(url, function (error, res, body) {
    plan.ok(!error, 'should not have errored')
    plan.equal(res.statusCode, 200, 'should have ok status')
    plan.deepEqual(body, { status: 'ok' }, 'should have expected response')
  })
  await plan.completed
})
