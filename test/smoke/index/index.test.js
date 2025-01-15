/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const { getTestSecret } = require('../../helpers/secrets')

const license = getTestSecret('TEST_LICENSE')
test('loading the application via index.js', { timeout: 15000 }, (t, end) => {
  let agent = null

  process.env.NEW_RELIC_HOME = path.join(__dirname, '..')
  process.env.NEW_RELIC_HOST = 'staging-collector.newrelic.com'
  process.env.NEW_RELIC_LICENSE_KEY = license

  assert.doesNotThrow(function () {
    const api = require('../../../index.js')
    agent = api.agent
    assert.equal(agent._state, 'connecting', 'agent is booting')
  }, "just loading the agent doesn't throw")

  let metric = agent.metrics.getMetric('Supportability/Nodejs/FeatureFlag/await_support/enabled')
  assert.ok(!metric, 'should not create metric for unchanged feature flags')

  metric = agent.metrics.getMetric('Supportability/Nodejs/FeatureFlag/internal_test_only/enabled')
  assert.ok(metric, 'should create metric for changed feature flags')

  function shutdown() {
    assert.equal(agent._state, 'started', "agent didn't error connecting to staging")
    assert.deepEqual(agent.config.applications(), ['My Application'], 'app name is valid')
    assert.equal(agent.config.agent_enabled, true, 'the agent is still enabled')

    agent.stop(function cbStop(err) {
      assert.ok(!err, 'should not error when stopping')
      assert.equal(agent._state, 'stopped', "agent didn't error shutting down")

      end()
    })
  }

  agent.once('errored', shutdown)
  agent.once('started', shutdown)
})
