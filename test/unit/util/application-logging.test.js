/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const loggingUtils = require('../../../lib/util/application-logging')

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
  const callCountStub = { incrementCallCount: sinon.stub() }
  const metricsStub = {
    getOrCreateMetric: sinon.stub().returns(callCountStub)
  }
  loggingUtils.incrementLoggingLinesMetrics('debug', metricsStub)
  t.equal(
    metricsStub.getOrCreateMetric.args[0][0],
    'Logging/lines',
    'should create Logging/lines metric'
  )
  t.equal(
    metricsStub.getOrCreateMetric.args[1][0],
    'Logging/lines/debug',
    'should create Logging/lines/debug metric'
  )
  t.equal(callCountStub.incrementCallCount.callCount, 2, 'should increment each metric')
  t.end()
})
