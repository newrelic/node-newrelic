/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const {getTestSecret, shouldSkipTest} = require('../../helpers/secrets')

const license = getTestSecret('TEST_LICENSE')
const skip = shouldSkipTest(license)
test('loading the application via index.js', {timeout: 15000, skip}, (t) => {
  let agent = null

  process.env.NEW_RELIC_HOME = __dirname + '/..'
  process.env.NEW_RELIC_HOST = 'staging-collector.newrelic.com'
  process.env.NEW_RELIC_LICENSE_KEY = license

  t.doesNotThrow(function() {
    var api = require('../../../index.js')
    agent = api.agent
    t.equal(agent._state, 'connecting', "agent is booting")
  }, "just loading the agent doesn't throw")

  var metric = agent.metrics.getMetric(
    'Supportability/Nodejs/FeatureFlag/await_support/enabled'
  )
  t.notOk(metric, 'should not create metric for unchanged feature flags')

  metric = agent.metrics.getMetric(
    'Supportability/Nodejs/FeatureFlag/express5/enabled'
  )
  t.ok(metric, 'should create metric for changed feature flags')

  function shutdown() {
    t.equal(agent._state, 'started', "agent didn't error connecting to staging")
    t.deepEquals(agent.config.applications(), ['My Application'], "app name is valid")
    t.equals(agent.config.agent_enabled, true, "the agent is still enabled")

    agent.stop(function cb_stop(err) {
      t.notOk(err, 'should not error when stopping')
      t.equal(agent._state, 'stopped', "agent didn't error shutting down")

      t.end()
    })
  }

  agent.once('errored', shutdown)
  agent.once('started', shutdown)
})
