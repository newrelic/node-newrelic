/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')
const NAMES = require('../../../lib/metrics/names')

tap.test('The API supportability metrics', (t) => {
  t.autoend()

  let agent = null
  let api = null

  const apiCalls = Object.keys(API.prototype)

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    api = new API(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  for (let i = 0; i < apiCalls.length; i++) {
    testMetricCalls(apiCalls[i])
  }

  function testMetricCalls(name) {
    const testName = 'should create a metric for API#' + name
    t.test(testName, (t) => {
      const beforeMetric = agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/' + name)
      t.equal(beforeMetric.callCount, 0)

      // Some api calls required a name to be given rather than just an empty string
      api[name]('test')

      const afterMetric = agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/' + name)
      t.equal(afterMetric.callCount, 1)

      t.end()
    })
  }
})
