/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const loggingUtils = require('../../../lib/util/application-logging')
const { LOGGING } = require('../../../lib/metrics/names')

test('truncate', async (t) => {
  await t.test('Should truncate string > 1024 chars', () => {
    const longString =
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111' +
      '1111111111111111111111111111111111111111111111111111111111111111'

    const processedStr = loggingUtils.truncate(longString)

    assert.equal(processedStr.length, 1024)
    assert.equal(processedStr.substring(processedStr.length - 3), '...')
  })

  await t.test('Should return non-truncated string when <= 1024 chars', () => {
    const str = 'kenny loggins'

    const processedStr = loggingUtils.truncate(str)

    assert.equal(processedStr, str)
  })

  const negativeTests = [
    { value: '', type: 'empty string' },
    { value: undefined, type: 'undefined' },
    { value: null, type: 'null' },
    { value: {}, type: 'object' },
    { value: [], type: 'array' },
    { value: function () {}, type: 'function' }
  ]
  for (const negativeTest of negativeTests) {
    const { value, type } = negativeTest
    await t.test(`should not truncate ${type}`, () => {
      const newValue = loggingUtils.truncate(value)
      assert.deepEqual(value, newValue)
    })
  }
})

test('Application Logging Config Tests', async (t) => {
  const features = [
    { feature: 'metrics', method: 'isMetricsEnabled' },
    { feature: 'forwarding', method: 'isLogForwardingEnabled' },
    { feature: 'local_decorating', method: 'isLocalDecoratingEnabled' }
  ]

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.config = {
      application_logging: {
        enabled: true,
        metrics: {
          enabled: false
        },
        forwarding: {
          labels: {
            enabled: false
          },
          enabled: false
        },
        local_decorating: {
          enabled: false
        }
      }
    }
  })

  await Promise.all(
    features.map(async ({ feature, method }) => {
      await t.test(
        `isApplicationLoggingEnabled should be true when application_logging and ${feature} is truthy`,
        (t) => {
          const { config } = t.nr
          config.application_logging[feature].enabled = true
          assert.equal(loggingUtils.isApplicationLoggingEnabled(config), true)
        }
      )

      await t.test(
        `${method} should be true when application_logging and ${feature} are truthy`,
        (t) => {
          const { config } = t.nr
          config.application_logging[feature].enabled = true
          if (feature === 'forwarding') {
            assert.equal(loggingUtils[method](config, { logs: true }), true)
          } else {
            assert.equal(loggingUtils[method](config), true)
          }
        }
      )
    })
  )

  await t.test('should be false when application_logging is false', (t) => {
    const { config } = t.nr
    config.application_logging.enabled = false
    assert.equal(loggingUtils.isApplicationLoggingEnabled(config), false)
  })

  await t.test('should be false when all features are false', (t) => {
    const { config } = t.nr
    assert.equal(loggingUtils.isApplicationLoggingEnabled(config), false)
  })

  await t.test('should be true when application_logging.forwarding.labels is true', (t) => {
    const { config } = t.nr
    config.application_logging.forwarding.labels.enabled = true
    assert.equal(loggingUtils.isLogLabelingEnabled(config), true)
  })

  await t.test('should be false when application_logging.forwarding.labels is false', (t) => {
    const { config } = t.nr
    config.application_logging.forwarding.labels.enabled = false
    assert.equal(loggingUtils.isLogLabelingEnabled(config), false)
  })
})

test('incrementLoggingLinesMetrics', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const callCountStub = { incrementCallCount: sinon.stub() }
    ctx.nr.metricsStub = {
      getOrCreateMetric: sinon.stub().returns(callCountStub)
    }
    ctx.nr.callCountStub = callCountStub
  })

  const levels = Object.keys(LOGGING.LEVELS)
  await Promise.all(
    levels.map(async (level) => {
      const levelLowercase = level.toLowerCase()
      await t.test(`should increment logging lines metrics for level: ${levelLowercase}`, (t) => {
        const { metricsStub, callCountStub } = t.nr
        loggingUtils.incrementLoggingLinesMetrics(levelLowercase, metricsStub)
        assert.equal(
          metricsStub.getOrCreateMetric.args[0][0],
          LOGGING.LINES,
          `should create ${LOGGING.LINES} metric`
        )
        assert.equal(
          metricsStub.getOrCreateMetric.args[1][0],
          LOGGING.LEVELS[level],
          `should create ${LOGGING.LEVELS[level]} metric`
        )
        assert.equal(callCountStub.incrementCallCount.callCount, 2, 'should increment each metric')
      })
    })
  )

  await t.test('should default to unknown when level is undefined', (t) => {
    const { metricsStub, callCountStub } = t.nr
    loggingUtils.incrementLoggingLinesMetrics(undefined, metricsStub)
    assert.equal(
      metricsStub.getOrCreateMetric.args[0][0],
      LOGGING.LINES,
      `should create ${LOGGING.LINES} metric`
    )
    assert.equal(
      metricsStub.getOrCreateMetric.args[1][0],
      LOGGING.LEVELS.UNKNOWN,
      `should create ${LOGGING.LEVELS.UNKNOWN} metric`
    )
    assert.equal(callCountStub.incrementCallCount.callCount, 2, 'should increment each metric')
  })
})
