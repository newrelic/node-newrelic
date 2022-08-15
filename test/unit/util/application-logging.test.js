/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const loggingUtils = require('../../../lib/util/application-logging')
const { LOGGING } = require('../../../lib/metrics/names')

tap.test('truncate', (t) => {
  t.autoend()
  t.test('Should truncate string > 1024 chars', (t) => {
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

    t.equal(processedStr.length, 1024)
    t.equal(processedStr.substring(processedStr.length - 3), '...')

    t.end()
  })

  t.test('Should return non-truncated string when <= 1024 chars', (t) => {
    const str = 'kenny loggins'

    const processedStr = loggingUtils.truncate(str)

    t.equal(processedStr, str)
    t.end()
  })

  const negativeTests = [
    { value: '', type: 'empty string' },
    { value: undefined, type: 'undefined' },
    { value: null, type: 'null' },
    { value: {}, type: 'object' },
    { value: [], type: 'array' },
    { value: function () {}, type: 'function' }
  ]
  negativeTests.forEach(({ value, type }) => {
    t.test(`should not truncate ${type}`, (t) => {
      const newValue = loggingUtils.truncate(value)
      t.same(value, newValue)
      t.end()
    })
  })
})

tap.test('Application Logging Config Tests', (t) => {
  t.autoend()
  const features = [
    { feature: 'metrics', method: 'isMetricsEnabled' },
    { feature: 'forwarding', method: 'isLogForwardingEnabled' },
    { feature: 'local_decorating', method: 'isLocalDecoratingEnabled' }
  ]

  let config = {}

  t.beforeEach(() => {
    config = {
      application_logging: {
        enabled: true,
        metrics: {
          enabled: false
        },
        forwarding: {
          enabled: false
        },
        local_decorating: {
          enabled: false
        }
      }
    }
  })

  features.forEach(({ feature, method }) => {
    t.test(
      `isApplicationLoggingEnabled should be true when application_logging and ${feature} is truthy`,
      (t) => {
        config.application_logging[feature].enabled = true
        t.equal(loggingUtils.isApplicationLoggingEnabled(config), true)
        t.end()
      }
    )

    t.test(`${method} should be true when application_logging and ${feature} are truthy`, (t) => {
      config.application_logging[feature].enabled = true
      if (feature === 'forwarding') {
        t.equal(loggingUtils[method](config, { logs: true }), true)
      } else {
        t.equal(loggingUtils[method](config), true)
      }
      t.end()
    })
  })

  t.test('should be false when application_logging is false', (t) => {
    config.application_logging.enabled = false
    t.equal(loggingUtils.isApplicationLoggingEnabled(config), false)
    t.end()
  })

  t.test('should be false when all features are false', (t) => {
    t.equal(loggingUtils.isApplicationLoggingEnabled(config), false)
    t.end()
  })
})

tap.test('incrementLoggingLinesMetrics', (t) => {
  t.autoend()
  let callCountStub = null
  let metricsStub = null
  t.beforeEach(() => {
    callCountStub = { incrementCallCount: sinon.stub() }
    metricsStub = {
      getOrCreateMetric: sinon.stub().returns(callCountStub)
    }
  })

  t.afterEach(() => {
    callCountStub = null
    metricsStub = null
  })

  const levels = Object.keys(LOGGING.LEVELS)
  levels.forEach((level) => {
    const levelLowercase = level.toLowerCase()
    t.test(`should increment logging lines metrics for level: ${levelLowercase}`, (t) => {
      loggingUtils.incrementLoggingLinesMetrics(levelLowercase, metricsStub)
      t.equal(
        metricsStub.getOrCreateMetric.args[0][0],
        LOGGING.LINES,
        `should create ${LOGGING.LINES} metric`
      )
      t.equal(
        metricsStub.getOrCreateMetric.args[1][0],
        LOGGING.LEVELS[level],
        `should create ${LOGGING.LEVELS[level]} metric`
      )
      t.equal(callCountStub.incrementCallCount.callCount, 2, 'should increment each metric')
      t.end()
    })
  })

  t.test('should default to unknown when level is undefined', (t) => {
    loggingUtils.incrementLoggingLinesMetrics(undefined, metricsStub)
    t.equal(
      metricsStub.getOrCreateMetric.args[0][0],
      LOGGING.LINES,
      `should create ${LOGGING.LINES} metric`
    )
    t.equal(
      metricsStub.getOrCreateMetric.args[1][0],
      LOGGING.LEVELS.UNKNOWN,
      `should create ${LOGGING.LEVELS.UNKNOWN} metric`
    )
    t.equal(callCountStub.incrementCallCount.callCount, 2, 'should increment each metric')
    t.end()
  })
})
