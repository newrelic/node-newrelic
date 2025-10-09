/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')
const tsplan = require('@matteo.collina/tspl')
const { setup, teardown } = require('./utils')

test.beforeEach(async (ctx) => {
  await setup(ctx)
})

test.afterEach(teardown)

test('ignoring an Express route', async function (t) {
  const { agent, app, port, isExpress5 } = t.nr
  const plan = tsplan(t, { plan: 8 })

  const api = new API(agent)

  agent.on('transactionFinished', function (transaction) {
    plan.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET//polling/:id',
      'transaction has expected name even on error'
    )

    plan.ok(transaction.ignore, 'transaction is ignored')

    plan.ok(!agent.traces.trace, 'should have no transaction trace')

    const metrics = agent.metrics._metrics.unscoped
    // loading k2 adds instrumentation metrics for things it loads
    let expectedMetrics = isExpress5 ? 5 : 3
    if (helper.isSecurityAgentEnabled(agent) === true) {
      expectedMetrics = isExpress5 ? 14 : 12
    }
    plan.equal(
      Object.keys(metrics).length,
      expectedMetrics,
      'only supportability metrics added to agent collection'
    )
    const errors = agent.errors.traceAggregator.errors
    plan.equal(errors.length, 0, 'no errors noticed')
  })

  app.get('/polling/:id', function (req, res) {
    api.addIgnoringRule(/poll/)
    res.status(400).send({ status: 'pollpollpoll' })
    res.end()
  })

  const url = 'http://localhost:' + port + '/polling/31337'
  helper.makeGetRequest(url, function (error, res, body) {
    plan.ifError(error)
    plan.equal(res.statusCode, 400, 'got expected error')
    plan.deepEqual(body, { status: 'pollpollpoll' }, 'got expected response')
  })
  await plan.completed
})
