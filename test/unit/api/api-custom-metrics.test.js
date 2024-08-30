/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

test('Agent API - custom metrics', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should prepend "Custom" in front of name', (t, end) => {
    const { api } = t.nr
    api.recordMetric('metric/thing', 3)
    api.recordMetric('metric/thing', 4)
    api.recordMetric('metric/thing', 5)

    const metric = api.agent.metrics.getMetric('Custom/metric/thing')
    assert.ok(metric)

    end()
  })

  await t.test('it should aggregate metric values', (t, end) => {
    const { api } = t.nr
    api.recordMetric('metric/thing', 3)
    api.recordMetric('metric/thing', 4)
    api.recordMetric('metric/thing', 5)

    const metric = api.agent.metrics.getMetric('Custom/metric/thing')

    assert.equal(metric.total, 12)
    assert.equal(metric.totalExclusive, 12)
    assert.equal(metric.min, 3)
    assert.equal(metric.max, 5)
    assert.equal(metric.sumOfSquares, 50)
    assert.equal(metric.callCount, 3)

    end()
  })

  await t.test('it should merge metrics', (t, end) => {
    const { api } = t.nr
    api.recordMetric('metric/thing', 3)
    api.recordMetric('metric/thing', {
      total: 9,
      min: 4,
      max: 5,
      sumOfSquares: 41,
      count: 2
    })

    const metric = api.agent.metrics.getMetric('Custom/metric/thing')

    assert.equal(metric.total, 12)
    assert.equal(metric.totalExclusive, 12)
    assert.equal(metric.min, 3)
    assert.equal(metric.max, 5)
    assert.equal(metric.sumOfSquares, 50)
    assert.equal(metric.callCount, 3)

    end()
  })

  await t.test('it should increment properly', (t, end) => {
    const { api } = t.nr
    api.incrementMetric('metric/thing')
    api.incrementMetric('metric/thing')
    api.incrementMetric('metric/thing')

    const metric = api.agent.metrics.getMetric('Custom/metric/thing')

    assert.equal(metric.total, 0)
    assert.equal(metric.totalExclusive, 0)
    assert.equal(metric.min, 0)
    assert.equal(metric.max, 0)
    assert.equal(metric.sumOfSquares, 0)
    assert.equal(metric.callCount, 3)

    api.incrementMetric('metric/thing', 4)
    api.incrementMetric('metric/thing', 5)

    assert.equal(metric.total, 0)
    assert.equal(metric.totalExclusive, 0)
    assert.equal(metric.min, 0)
    assert.equal(metric.max, 0)
    assert.equal(metric.sumOfSquares, 0)
    assert.equal(metric.callCount, 12)

    end()
  })
})
