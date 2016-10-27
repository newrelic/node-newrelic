'use strict'

// hapi 1.20.0 depends on node 0.10.x
var semver = require('semver')
if (semver.satisfies(process.version, '<0.10')) {
  console.log('TAP version 13\n# disabled because of incompatibility')
  console.log('ok 1 nothing to do\n\n1..1\n\n# ok')
  process.exit(0)
}

var test    = require('tap').test
var request = require('request')
var helper  = require('../../lib/agent_helper.js')
var API     = require('../../../api.js')


test("ignoring a Hapi route", function(t) {
  t.plan(7)

  var agent  = helper.instrumentMockedAgent()
  var api    = new API(agent)
  var hapi   = require('hapi')
  var server = hapi.createServer('localhost', 8089)


  t.tearDown(function cb_tearDown() {
    server.stop(function cb_stop() {
      helper.unloadAgent(agent)
    })
  })

  agent.on('transactionFinished', function(transaction) {
    t.equal(transaction.name, 'WebTransaction/Hapi/GET//order/{id}',
            "transaction has expected name even on error")
    t.ok(transaction.ignore, "transaction is ignored")

    t.notOk(agent.traces.trace, "should have no transaction trace")

    var metrics = agent.metrics.unscoped
    t.equal(Object.keys(metrics).length, 1,
      "only supportability metrics added to agent collection"
    )

    var errors = agent.errors.errors
    t.equal(errors.length, 0, "no errors noticed")
  })

  server.route({
    method  : 'GET',
    path    : '/order/{id}',
    handler : function(request, reply) {
      api.setIgnoreTransaction(true)

      reply({status : 'cartcartcart'}).code(400)
    }
  })

  server.start(function cb_start() {
    request.get('http://localhost:8089/order/31337',
                {json : true},
                function(error, res, body) {

      t.equal(res.statusCode, 400, "got expected error")
      t.deepEqual(body, {status : 'cartcartcart'}, "got expected response")
    })
  })
})
