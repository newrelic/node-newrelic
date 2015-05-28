'use strict'

var path = require('path')
var test = require('tap').test
var configurator = require('../../../lib/config')
var Agent = require('../../../lib/agent')

test("Agent should send errors to staging-collector.newrelic.com", function (t) {
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
    t.notOk(error, "connected without error")

    var transaction
    var proxy = agent.tracer.transactionProxy(function cb_transactionProxy() {
      transaction = agent.getTransaction()
      transaction.setName('/nonexistent', 501)
    })
    proxy()
    t.ok(transaction, "got a transaction")
    agent.errors.add(transaction, new Error('test error'))

    agent._sendErrors(function cb__sendErrors(error) {
      t.notOk(error, "sent errors without error")

      agent.stop(function cb_stop(error) {
        t.notOk(error, "stopped without error")

        t.end()
      })
    })
  })
})
