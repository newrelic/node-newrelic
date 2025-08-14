/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')

test('Restify router introspection', async function (t) {
  const plan = tspl(t, { plan: 8 })

  const agent = helper.instrumentMockedAgent()
  const api = new API(agent)
  const server = require('restify').createServer()

  t.after(function () {
    server.close(function () {
      helper.unloadAgent(agent)
    })
  })

  agent.on('transactionFinished', function (transaction) {
    plan.equal(
      transaction.name,
      'WebTransaction/Restify/GET//polling/:id',
      'transaction has expected name even on error'
    )

    plan.ok(transaction.ignore, 'transaction is ignored')

    plan.ok(!agent.traces.trace, 'should have no transaction trace')

    // Domain usage varies by version so just checking list of known allowed metric patterns.
    const potentialSupportMetrics = [
      'Supportability/API/addIgnoringRule',
      'Supportability/Features/instrumentation/onRequire/domain',
      'Supportability/Features/instrumentation/onRequire/restify'
    ]

    const metrics = agent.metrics._metrics.unscoped

    const unexpectedMetrics = Object.keys(metrics).filter((metricName) => {
      const matching = potentialSupportMetrics.filter((value) => metricName.startsWith(value))

      return matching > 0
    })

    plan.equal(unexpectedMetrics.length, 0, 'only supportability metrics added to agent collection')

    const errors = agent.errors.traceAggregator.errors
    plan.equal(errors.length, 0, 'no errors noticed')
  })

  server.get('/polling/:id', function (req, res, next) {
    api.addIgnoringRule(/poll/)
    res.send(400, { status: 'pollpollpoll' })
    next()
  })

  server.listen(0, function () {
    const port = server.address().port
    const url = 'http://localhost:' + port + '/polling/31337'
    helper.makeGetRequest(url, function (error, res, body) {
      plan.ifError(error)
      plan.equal(res.statusCode, 400, 'got expected error')
      plan.deepEqual(body, { status: 'pollpollpoll' }, 'got expected response')
    })
  })

  await plan.completed
})
