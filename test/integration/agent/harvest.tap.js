'use strict'

var path         = require('path')
  , test         = require('tap').test
  , configurator = require('../../../lib/config')
  , Agent        = require('../../../lib/agent')


test("Agent should send a whole harvest to New Relic staging", function (t) {
  var config = configurator.initialize({
        'app_name'    : 'node.js Tests',
        'license_key' : 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
        'host'        : 'staging-collector.newrelic.com',
        'port'        : 80,
        'ssl'         : false,
        'logging'     : {
          'level' : 'trace'
        }
      })
    , agent = new Agent(config)


  agent.start(function cb_start(error) {
    t.notOk(error, "connected without error")

    agent.metrics.measureMilliseconds('TEST/discard', null, 101)

    var transaction
    var proxy = agent.tracer.transactionProxy(function cb_transactionProxy() {
      transaction = agent.getTransaction()
      transaction.setName('/nonexistent', 501)
    })
    proxy()
    // ensure it's slow enough to get traced
    transaction.getTrace().setDurationInMillis(5001)
    transaction.end(function() {
      t.ok(agent.traces.trace, "have a slow trace to send")

      agent.harvest(function cb_harvest(error) {
        t.notOk(error, "harvest ran correctly")

        agent.stop(function cb_stop(error) {
          t.notOk(error, "stopped without error")

          t.end()
        })
      })
    })
  })
})
