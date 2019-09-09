'use strict'

var tap = require('tap')
var configurator = require('../../../lib/config')
var Agent = require('../../../lib/agent')


tap.test('Collector API should send errors to newrelic.com', function(t) {
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
  var api = agent.collector


  api.connect(function(error) {
    t.error(error, 'connected without error')

    var transaction
    var proxy = agent.tracer.transactionProxy(function() {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 200)
    })
    proxy()

    // ensure it's slow enough to get traced
    transaction.trace.setDurationInMillis(5001)
    transaction.end()
    t.ok(agent.traces.trace, 'have a slow trace to send')

    agent.traces.trace.generateJSON((err, encoded) => {
      t.error(err, 'should encode trace without error')
      t.ok(encoded, 'have the encoded trace')

      var payload = [
        agent.config.run_id,
        [encoded]
      ]

      api.transaction_sample_data(payload, function(error, command) {
        t.error(error, 'sent transaction trace without error')
        t.notOk(command.returned, 'return value is null')

        agent.stop((err) => {
          t.error(err, 'should not fail to stop')
          t.end()
        })
      })
    })
  })
})
