/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')
const promiseResolvers = require('../../lib/promise-resolvers')
const { setup, teardown } = require('./utils')

test('ignoring an Express route', async function (t) {
  t.plan(8)

  await setup(t)
  t.after(() => { teardown(t) })

  const { agent, app, port } = t.nr
  const { promise, resolve } = promiseResolvers()
  const api = new API(agent)

  agent.on('transactionFinished', function (transaction) {
    t.assert.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET//polling/:id',
      'transaction has expected name even on error'
    )

    t.assert.ok(transaction.ignore, 'transaction is ignored')

    t.assert.ok(!agent.traces.trace, 'should have no transaction trace')

    const metrics = Object.keys(agent.metrics._metrics.unscoped).filter(
      (k) => k.startsWith('Supportability/') === false
    )
    t.assert.equal(
      metrics.length,
      0,
      'only supportability metrics added to agent collection'
    )

    const errors = agent.errors.traceAggregator.errors
    t.assert.equal(errors.length, 0, 'no errors noticed')
  })

  app.get('/polling/:id', function (req, res) {
    api.addIgnoringRule(/poll/)
    res.status(400).send({ status: 'pollpollpoll' })
    res.end()
  })

  const url = 'http://localhost:' + port + '/polling/31337'
  helper.makeGetRequest(url, function (error, res, body) {
    t.assert.ifError(error)
    t.assert.equal(res.statusCode, 400, 'got expected error')
    t.assert.deepEqual(body, { status: 'pollpollpoll' }, 'got expected response')

    // The request finished callback is invoked after the transactionFinished
    // callback. So we must trigger the end of the test here.
    resolve()
  })

  await promise
})
