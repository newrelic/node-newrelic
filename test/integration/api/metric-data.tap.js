'use strict'

var test = require('tap').test
var configurator = require('../../../lib/config')
var Agent = require('../../../lib/agent')
var CollectorAPI = require('../../../lib/collector/api')


test('Collector API should send metrics to staging-collector.newrelic.com', function(t) {
  var config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
    host: 'staging-collector.newrelic.com',
    port: 443,
    ssl: true,
    utilization: {
      detect_aws: false,
      detect_azure: false,
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

    agent.metrics.measureMilliseconds('TEST/discard', null, 101)

    const metrics = agent.metrics._metrics

    const metricJson = metrics.toJSON()
    t.ok(metricJson.length >= 2, 'Should have at least two metrics.')

    var payload = [
      agent.config.run_id,
      metrics.started  / 1000,
      Date.now() / 1000,
      metrics
    ]

    api.metric_data(payload, function(error, command) {
      t.notOk(error, 'sent metrics without error')
      t.ok(command, 'got a response')

      t.deepEqual(command, {retainData: false})

      t.end()
    })
  })
})
