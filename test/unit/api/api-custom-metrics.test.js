/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - custom metrics', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    agent = null

    done()
  })

  t.test('should prepend "Custom" in front of name', (t) => {
    api.recordMetric('metric/thing', 3)
    api.recordMetric('metric/thing', 4)
    api.recordMetric('metric/thing', 5)

    const metric = api.agent.metrics.getMetric('Custom/metric/thing')
    t.ok(metric)

    t.end()
  })

  t.test('it should aggregate metric values', (t) => {
    api.recordMetric('metric/thing', 3)
    api.recordMetric('metric/thing', 4)
    api.recordMetric('metric/thing', 5)

    const metric = api.agent.metrics.getMetric('Custom/metric/thing')

    t.equal(metric.total, 12)
    t.equal(metric.totalExclusive, 12)
    t.equal(metric.min, 3)
    t.equal(metric.max, 5)
    t.equal(metric.sumOfSquares, 50)
    t.equal(metric.callCount, 3)

    t.end()
  })

  t.test('it should merge metrics', (t) => {
    api.recordMetric('metric/thing', 3)
    api.recordMetric('metric/thing', {
      total: 9,
      min: 4,
      max: 5,
      sumOfSquares: 41,
      count: 2
    })

    const metric = api.agent.metrics.getMetric('Custom/metric/thing')

    t.equal(metric.total, 12)
    t.equal(metric.totalExclusive, 12)
    t.equal(metric.min, 3)
    t.equal(metric.max, 5)
    t.equal(metric.sumOfSquares, 50)
    t.equal(metric.callCount, 3)

    t.end()
  })

  t.test('it should increment properly', (t) => {
    api.incrementMetric('metric/thing')
    api.incrementMetric('metric/thing')
    api.incrementMetric('metric/thing')

    const metric = api.agent.metrics.getMetric('Custom/metric/thing')

    t.equal(metric.total, 0)
    t.equal(metric.totalExclusive, 0)
    t.equal(metric.min, 0)
    t.equal(metric.max, 0)
    t.equal(metric.sumOfSquares, 0)
    t.equal(metric.callCount, 3)

    api.incrementMetric('metric/thing', 4)
    api.incrementMetric('metric/thing', 5)

    t.equal(metric.total, 0)
    t.equal(metric.totalExclusive, 0)
    t.equal(metric.min, 0)
    t.equal(metric.max, 0)
    t.equal(metric.sumOfSquares, 0)
    t.equal(metric.callCount, 12)

    t.end()
  })
})
