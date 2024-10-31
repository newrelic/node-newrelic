/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const tsplan = require('@matteo.collina/tspl')
const { setup, teardown } = require('./utils')

test.beforeEach(async (ctx) => {
  await setup(ctx)
})

test.afterEach(teardown)

test('Express router introspection', async function (t) {
  const { agent, app, port } = t.nr
  const plan = tsplan(t, { plan: 12 })

  // need to capture parameters
  agent.config.attributes.enabled = true

  agent.on('transactionFinished', function (transaction) {
    plan.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET//test',
      'transaction has expected name'
    )

    plan.equal(transaction.url, '/test', 'URL is left alone')
    plan.equal(transaction.statusCode, 200, 'status code is OK')
    plan.equal(transaction.verb, 'GET', 'HTTP method is GET')
    plan.ok(transaction.trace, 'transaction has trace')

    const [web] = transaction.trace.getChildren(transaction.trace.root.id)
    plan.ok(web, 'trace has web segment')
    plan.equal(web.name, transaction.name, 'segment name and transaction name match')

    plan.equal(web.partialName, 'Expressjs/GET//test', 'should have partial name for apdex')
  })

  app.get('/test', function (req, res) {
    plan.ok(agent.getTransaction(), 'transaction is available')

    res.send({ status: 'ok' })
    res.end()
  })

  const url = 'http://localhost:' + port + '/test'
  helper.makeGetRequest(url, { json: true }, function (error, res, body) {
    plan.ifError(error)
    plan.equal(res.statusCode, 200, 'nothing exploded')
    plan.deepEqual(body, { status: 'ok' }, 'got expected response')
  })
  await plan.completed
})
