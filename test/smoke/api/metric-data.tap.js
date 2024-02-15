/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')
const CollectorAPI = require('../../../lib/collector/api')
const { getTestSecret } = require('../../helpers/secrets')

const license = getTestSecret('TEST_LICENSE')
test('Collector API should send metrics to staging-collector.newrelic.com', (t) => {
  const config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: license,
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
  const agent = new Agent(config)
  const api = new CollectorAPI(agent)

  api.connect(function (error) {
    t.notOk(error, 'connected without error')

    agent.metrics.measureMilliseconds('TEST/discard', null, 101)

    const metrics = agent.metrics._metrics

    const metricJson = metrics.toJSON()
    t.ok(metricJson.length >= 2, 'Should have at least two metrics.')

    const payload = [agent.config.run_id, metrics.started / 1000, Date.now() / 1000, metrics]

    api.send('metric_data', payload, function (error, command) {
      t.notOk(error, 'sent metrics without error')
      t.ok(command, 'got a response')

      t.same(command, { retainData: false })

      t.end()
    })
  })
})
