/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')
const NAMES = require('../../../lib/metrics/names')

test('The API supportability metrics', async (t) => {
  const apiCalls = Object.keys(API.prototype)

  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  for (const key of apiCalls) {
    await testMetricCalls(key)
  }

  async function testMetricCalls(name) {
    await t.test(`should create a metric for API#${name}`, (t, end) => {
      const { agent, api } = t.nr
      const beforeMetric = agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/' + name)
      assert.equal(beforeMetric.callCount, 0)

      // Some api calls required a name to be given rather than just an empty string
      api[name]('test')

      const afterMetric = agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/' + name)
      assert.equal(afterMetric.callCount, 1)

      end()
    })
  }
})
