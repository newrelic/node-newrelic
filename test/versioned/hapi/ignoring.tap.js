/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')
const API = require('../../../api')
const utils = require('./hapi-utils')

test('ignoring a Hapi route', function (t) {
  t.plan(6)

  const agent = helper.instrumentMockedAgent()
  const api = new API(agent)
  const server = utils.getServer()

  t.teardown(function () {
    helper.unloadAgent(agent)
    return server.stop()
  })

  agent.on('transactionFinished', function (transaction) {
    t.ok(transaction.ignore, 'transaction is ignored')

    t.notOk(agent.traces.trace, 'should have no transaction trace')

    const metrics = agent.metrics._metrics.unscoped
    // loading k2 adds instrumentation metrics for packages it instruments
    const expectedMetrics = helper.isSecurityAgentEnabled(agent) ? 11 : 3
    t.equal(
      Object.keys(metrics).length,
      expectedMetrics,
      'only supportability metrics added to agent collection'
    )

    const errors = agent.errors.traceAggregator.errors
    t.equal(errors.length, 0, 'no errors noticed')
  })

  server.route({
    method: 'GET',
    path: '/order/{id}',
    handler: function (req, h) {
      api.addIgnoringRule(/order/)
      return h.response({ status: 'cartcartcart' }).code(400)
    }
  })

  server.start().then(function () {
    const port = server.info.port
    const uri = 'http://localhost:' + port + '/order/31337'
    helper.makeGetRequest(uri, function (_error, res, body) {
      t.equal(res.statusCode, 400, 'got expected error')
      t.same(body, { status: 'cartcartcart' }, 'got expected response')
    })
  })
})
