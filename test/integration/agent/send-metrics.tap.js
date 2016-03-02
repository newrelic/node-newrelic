'use strict'

var path = require('path')
var test = require('tap').test
var configurator = require('../../../lib/config')
var Agent = require('../../../lib/agent')

test("Agent should send metrics to staging-collector.newrelic.com", function (t) {
  var config = configurator.initialize({
        'app_name': 'node.js Tests',
        'license_key': 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
        'host': 'staging-collector.newrelic.com',
        'port': 80,
        'ssl': false,
        'utilization': {
          'detect_aws': false,
          'detect_docker': false
        },
        'logging': {
          'level': 'trace'
        }
      })
  var agent = new Agent(config)

  agent.start(function cb_start(error) {
    t.notOk(error, "started without error")

    agent.metrics.measureMilliseconds('TEST/discard', null, 101)

    var metrics = agent.metrics.toJSON()
    t.ok(findMetric(metrics, 'TEST/discard'), 'the test metric should be present')

    agent._sendMetrics(function cb__sendMetrics(error) {
      t.notOk(error, "sent metrics without error")

      agent.stop(function cb_stop(error) {
        t.notOk(error, "stopped without error")

        t.end()
      })
    })
  })
})

function findMetric(metrics, name) {
  for (var i = 0; i < metrics.length; i++) {
    var metric = metrics[i]
    if (metric[0].name === name) return metric
  }
}