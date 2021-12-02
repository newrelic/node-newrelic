/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const request = require('request')
const helper = require('../../../lib/agent_helper')
const API = require('../../../../api')
const utils = require('./hapi-utils')

tap.test('ignoring a Hapi route', function (t) {
  t.plan(7)

  const agent = helper.instrumentMockedAgent()

  const api = new API(agent)
  const server = utils.getServer()
  let port = null

  t.teardown(function () {
    server.stop(function () {
      helper.unloadAgent(agent)
    })
  })

  agent.on('transactionFinished', function (tx) {
    t.equal(
      tx.name,
      'WebTransaction/Hapi/GET//order/{id}',
      'transaction has expected name even on error'
    )

    t.ok(tx.ignore, 'transaction is ignored')

    t.notOk(agent.traces.trace, 'should have no transaction trace')

    // Vision usage varies by version so just checking list of known allowed metric patterns.
    const potentialSupportMetrics = [
      'Supportability/API/addIgnoringRule',
      'Supportability/Features/instrumentation/onRequire/vision',
      'Supportability/Features/instrumentation/onRequire/domain',
      'Supportability/Features/instrumentation/onRequire/hapi'
    ]

    const metrics = agent.metrics._metrics.unscoped

    const unexpectedMetrics = Object.keys(metrics).filter((metricName) => {
      const matching = potentialSupportMetrics.filter((value) => {
        return metricName.startsWith(value)
      })

      return matching > 0
    })

    t.equal(unexpectedMetrics.length, 0, 'only supportability metrics added to agent collection')

    const errors = agent.errors.traceAggregator.errors
    t.equal(errors.length, 0, 'no errors noticed')
  })

  server.route({
    method: 'GET',
    path: '/order/{id}',
    handler: function (req, reply) {
      api.addIgnoringRule(/order/)
      reply({ status: 'cartcartcart' }).code(400)
    }
  })

  server.start(function () {
    port = server.info.port
    const params = {
      uri: 'http://localhost:' + port + '/order/31337',
      json: true
    }
    request.get(params, function (error, res, body) {
      t.equal(res.statusCode, 400, 'got expected error')
      t.deepEqual(body, { status: 'cartcartcart' }, 'got expected response')
    })
  })
})
