/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')
const {getTestSecret, shouldSkipTest} = require('../../helpers/secrets')


const license = getTestSecret('TEST_LICENSE')
const skip = shouldSkipTest(license)
test('Collector API should send errors to staging-collector.newrelic.com', {skip}, (t) => {
  const config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: license,
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
  var api = agent.collector

  api.connect(function(error) {
    t.error(error, 'connected without error')

    var transaction
    var proxy = agent.tracer.transactionProxy(function() {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 501)
    })
    proxy()
    t.ok(transaction, 'got a transaction')
    agent.errors.add(transaction, new Error('test error'))

    var payload = [
      agent.config.run_id,
      agent.errors.traceAggregator.errors
    ]

    api.error_data(payload, function(error, command) {
      t.error(error, 'sent errors without error')
      t.notOk(command.returned, 'return value is null')

      agent.stop((err) => {
        t.error(err, 'should not fail to stop')
        t.end()
      })
    })
  })
})
