'use strict'

// process.exit(0)

var test = require('tap').test
var request = require('request')
var helper = require('../../lib/agent_helper')
var API = require('../../../api')
var conditions = require('./conditions')

test('ignoring a Hapi route', conditions, function(t) {
  t.plan(6)

  var agent = helper.instrumentMockedAgent()
  var api = new API(agent)
  var hapi = require('hapi')
  var server = new hapi.Server({
    host: 'localhost',
    port: 8089
  })

  t.tearDown(function() {
    helper.unloadAgent(agent)
    return server.stop()
  })

  agent.on('transactionFinished', function(transaction) {
    t.ok(transaction.ignore, 'transaction is ignored')

    t.notOk(agent.traces.trace, 'should have no transaction trace')

    var metrics = agent.metrics.unscoped
    t.equal(Object.keys(metrics).length, 1,
      'only supportability metrics added to agent collection'
    )

    var errors = agent.errors.errors
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
    var params = {
      uri: 'http://localhost:8089/order/31337',
      json: true
    }
    request.get(params, function(error, res, body) {
      t.equal(res.statusCode, 400, 'got expected error')
      t.deepEqual(body, {status: 'cartcartcart'}, 'got expected response')
    })
  })
})
