'use strict'

var tap = require('tap')
var configurator = require('../../../lib/config')
var Agent = require('../../../lib/agent')
var CollectorAPI = require('../../../lib/collector/api')


tap.test('Collector API should send errors to newrelic.com', function(t) {
  var config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: 'ed2a0ac637297d08c5592c0200050fe234802223',
    host: 'staging-collector.newrelic.com',
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
  var api = new CollectorAPI(agent)


  api.connect(function(error) {
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

      agent.traces.harvest(function(error, encoded) {
        t.notOk(error, 'trace encoded properly')
        t.ok(encoded, 'have the encoded trace')

        var payload = [
          agent.config.run_id,
          encoded
        ]

        api.transactionSampleData(payload, function(error, response, json) {
          t.notOk(error, 'sent transaction trace without error')
          t.notOk(response, 'return value is null')
          t.deepEqual(json, {return_value: null}, 'got raw return value')

          t.end()
        })
      })
    })
  })
})
