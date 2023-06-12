/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../../lib/agent_helper')
const API = require('../../../../api')
const semver = require('semver')

test('Restify router introspection', function (t) {
  t.plan(7)

  const agent = helper.instrumentMockedAgent()
  const api = new API(agent)
  const { version: pkgVersion } = require('restify/package')
  const server = require('restify').createServer()

  t.teardown(function () {
    server.close(function () {
      helper.unloadAgent(agent)
    })
  })

  agent.on('transactionFinished', function (transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Restify/GET//polling/:id',
      'transaction has expected name even on error'
    )

    t.ok(transaction.ignore, 'transaction is ignored')

    t.notOk(agent.traces.trace, 'should have no transaction trace')

    const metrics = agent.metrics._metrics.unscoped
    // loading k2 adds instrumentation metrics for things it registers
    // this also differs between major versions of restify. 6+ also loads
    // k2 child_process instrumentation, fun fun fun
    const expectedMetrics = helper.isSecurityAgentEnabled(agent)
      ? semver.lt(pkgVersion, 'v6.0.0')
        ? 14
        : 15
      : 7
    t.equal(
      Object.keys(metrics).length,
      expectedMetrics,
      'only supportability metrics added to agent collection'
    )

    const errors = agent.errors.traceAggregator.errors
    t.equal(errors.length, 0, 'no errors noticed')
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
      t.equal(res.statusCode, 400, 'got expected error')
      t.same(body, { status: 'pollpollpoll' }, 'got expected response')
    })
  })
})
