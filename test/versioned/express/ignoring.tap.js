/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const request = require('request')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')

test('ignoring an Express route', function (t) {
  t.plan(7)

  const agent = helper.instrumentMockedAgent()

  const api = new API(agent)
  const express = require('express')
  const app = express()
  const server = require('http').createServer(app)

  t.teardown(() => {
    server.close(() => {
      helper.unloadAgent(agent)
    })
  })

  agent.on('transactionFinished', function (transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET//polling/:id',
      'transaction has expected name even on error'
    )

    t.ok(transaction.ignore, 'transaction is ignored')

    t.notOk(agent.traces.trace, 'should have no transaction trace')

    const metrics = agent.metrics._metrics.unscoped
    t.equal(Object.keys(metrics).length, 3, 'only supportability metrics added to agent collection')

    const errors = agent.errors.traceAggregator.errors
    t.equal(errors.length, 0, 'no errors noticed')
  })

  app.get('/polling/:id', function (req, res) {
    api.addIgnoringRule(/poll/)
    res.status(400).send({ status: 'pollpollpoll' })
    res.end()
  })

  server.listen(0, function () {
    const port = server.address().port
    const url = 'http://localhost:' + port + '/polling/31337'
    request.get(url, { json: true }, function (error, res, body) {
      t.equal(res.statusCode, 400, 'got expected error')
      t.deepEqual(body, { status: 'pollpollpoll' }, 'got expected response')
    })
  })
})
