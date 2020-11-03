/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var tap = require('tap')
var request = require('request')
var helper = require('../../../lib/agent_helper')
var API = require('../../../../api')
var utils = require('./hapi-utils')

tap.test('ignoring a Hapi route', function(t) {
  t.plan(7)

  const agent = helper.instrumentMockedAgent()

  var api = new API(agent)
  var server = utils.getServer()
  var port = null

  t.tearDown(function() {
    server.stop(function() {
      helper.unloadAgent(agent)
    })
  })

  agent.on('transactionFinished', function(tx) {
    t.equal(
      tx.name,
      'WebTransaction/Hapi/GET//order/{id}',
      'transaction has expected name even on error'
    )

    t.ok(tx.ignore, 'transaction is ignored')

    t.notOk(agent.traces.trace, 'should have no transaction trace')

    var metrics = agent.metrics._metrics.unscoped
    t.equal(Object.keys(metrics).length, 1,
      'only supportability metrics added to agent collection'
    )

    var errors = agent.errors.traceAggregator.errors
    t.equal(errors.length, 0, 'no errors noticed')
  })

  server.route({
    method: 'GET',
    path: '/order/{id}',
    handler: function(req, reply) {
      api.addIgnoringRule(/order/)
      reply({status: 'cartcartcart'}).code(400)
    }
  })

  server.start(function() {
    port = server.info.port
    var params = {
      uri: 'http://localhost:' + port + '/order/31337',
      json: true
    }
    request.get(params, function(error, res, body) {
      t.equal(res.statusCode, 400, 'got expected error')
      t.deepEqual(body, {status: 'cartcartcart'}, 'got expected response')
    })
  })
})
