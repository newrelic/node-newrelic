/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const { getTestSecret } = require('../../helpers/secrets')

const license = getTestSecret('TEST_LICENSE')
test('loading the application via index.js', { timeout: 15000 }, (t) => {
  let agent = null

  process.env.NEW_RELIC_HOME = __dirname + '/..'
  process.env.NEW_RELIC_HOST = 'staging-collector.newrelic.com'
  process.env.NEW_RELIC_LICENSE_KEY = license

  t.doesNotThrow(function () {
    const api = require('../../../index.js')
    agent = api.agent
    t.equal(agent._state, 'connecting', 'agent is booting')
  }, "just loading the agent doesn't throw")

  let metric = agent.metrics.getMetric('Supportability/Nodejs/FeatureFlag/await_support/enabled')
  t.notOk(metric, 'should not create metric for unchanged feature flags')

  metric = agent.metrics.getMetric('Supportability/Nodejs/FeatureFlag/internal_test_only/enabled')
  t.ok(metric, 'should create metric for changed feature flags')

  function shutdown() {
    t.equal(agent._state, 'started', "agent didn't error connecting to staging")
    t.same(agent.config.applications(), ['My Application'], 'app name is valid')
    t.equal(agent.config.agent_enabled, true, 'the agent is still enabled')

    agent.stop(function cbStop(err) {
      t.notOk(err, 'should not error when stopping')
      t.equal(agent._state, 'stopped', "agent didn't error shutting down")

      t.end()
    })
  }

  agent.once('errored', shutdown)
  agent.once('started', shutdown)
})
