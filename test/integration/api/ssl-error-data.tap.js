'use strict'

var path = require('path')
var test = require('tap').test
var configurator = require('../../../lib/config')
var Agent = require('../../../lib/agent')
var CollectorAPI = require('../../../lib/collector/api.js')


test("Collector API should send errors to staging-collector.newrelic.com", function (t) {
  var config = configurator.initialize({
        'app_name': 'node.js Tests',
        'license_key': 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
        'host': 'staging-collector.newrelic.com',
        'port': 443,
        'ssl': true,
        'utilization': {
          'detect_aws': false,
          'detect_docker': false
        },
        'logging': {
          'level': 'trace'
        }
      })
  var agent = new Agent(config)
  var api = new CollectorAPI(agent)


  api.connect(function cb_connect(error) {
    t.notOk(error, "connected without error")

    var transaction
    var proxy = agent.tracer.transactionProxy(function cb_transactionProxy() {
      transaction = agent.getTransaction()
      transaction.setName('/nonexistent', 501)
    })
    proxy()
    t.ok(transaction, "got a transaction")
    agent.errors.add(transaction, new Error('test error'))

    var payload = [
      agent.config.run_id,
      agent.errors.errors
    ]

    api.errorData(payload, function (error, response, json) {
      t.notOk(error, "sent errors without error")
      t.notOk(response, "return value is null")
      t.deepEqual(json, {return_value: null}, "got raw return value")

      t.end()
    })
  })
})
