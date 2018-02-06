'use strict'

var tap = require('tap')
var configurator = require('../../../lib/config')
var Agent = require('../../../lib/agent')


tap.test('Agent should send trace to newrelic.com', function(t) {
  var config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: 'ed2a0ac637297d08c5592c0200050fe234802223',
    port: 443,
    ssl: true,
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_gcp: false,
      detect_docker: false
    },
    logging: {
      level: 'trace'
    }
  })
  var agent = new Agent(config)


  agent.start(function(error) {
    t.notOk(error, 'connected without error')

    var transaction
    var proxy = agent.tracer.transactionProxy(function() {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 200)
    })
    proxy()
    // ensure it's slow enough to get traced
    transaction.trace.setDurationInMillis(5001)
    transaction.end(function() {
      t.ok(agent.traces.trace, 'have a slow trace to send')

      agent._sendTrace(function(error) {
        t.notOk(error, 'trace sent correctly')

        agent.stop(function(error) {
          t.notOk(error, 'stopped without error')

          t.end()
        })
      })
    })
  })
})
