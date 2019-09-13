'use strict'

var test = require('tap').test
var request = require('request')
var helper = require('../../../lib/agent_helper')
var API = require('../../../../api')
var utils = require('./hapi-17-utils')

test('ignoring a Hapi route', function(t) {
  t.plan(6)

  const agent = helper.instrumentMockedAgent()
  const api = new API(agent)
  const server = utils.getServer()

  t.tearDown(function() {
    helper.unloadAgent(agent)
    return server.stop()
  })

  agent.on('transactionFinished', function(transaction) {
    t.ok(transaction.ignore, 'transaction is ignored')

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
    handler: function(req, h) {
      api.setIgnoreTransaction(true)
      return h.response({ status: 'cartcartcart' }).code(400)
    }
  })

  server.start().then(function() {
    var port = server.info.port
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
