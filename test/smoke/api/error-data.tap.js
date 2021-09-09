/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')
const { getTestSecret } = require('../../helpers/secrets')

const license = getTestSecret('TEST_LICENSE')
test('Collector API should send errors to staging-collector.newrelic.com', (t) => {
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
  const agent = new Agent(config)
  const api = agent.collector

  api.connect(function (error) {
    t.error(error, 'connected without error')

    let transaction
    const proxy = agent.tracer.transactionProxy(function () {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 501)
    })
    proxy()
    t.ok(transaction, 'got a transaction')
    agent.errors.add(transaction, new Error('test error'))

    const payload = [agent.config.run_id, agent.errors.traceAggregator.errors]

    api.error_data(payload, function (error, command) {
      t.error(error, 'sent errors without error')
      t.notOk(command.returned, 'return value is null')

      agent.stop((err) => {
        t.error(err, 'should not fail to stop')
        t.end()
      })
    })
  })
})
