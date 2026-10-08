/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const Config = require('../../../lib/config')
const getTrackingMetricName = require('../../../lib/llm-events/get-tracking-metric-name')

const UNSET = 'unset'
const BASE_METRIC = 'Supportability/Nodejs/ML/OpenAI/4.0.0'
const BASIC_METRIC = `${BASE_METRIC}/Basic`

/**
 * Builds an agent configuration through the real config loader so that
 * `unset` values receive their actual schema defaults.
 *
 * @param {object} params The configuration values to apply.
 * @param {boolean} params.basic The value of `ai_monitoring.basic_telemetry.enabled`.
 * @param {boolean|string} params.enabled The value of `ai_monitoring.enabled`, or `unset`.
 * @param {boolean|string} params.content The value of `ai_monitoring.record_content.enabled`, or `unset`.
 * @returns {Config} The agent configuration.
 */
function buildConfig({ basic, enabled, content }) {
  const aiMonitoring = { basic_telemetry: { enabled: basic } }
  if (enabled !== UNSET) {
    aiMonitoring.enabled = enabled
  }
  if (content !== UNSET) {
    aiMonitoring.record_content = { enabled: content }
  }
  return Config.initialize({ ai_monitoring: aiMonitoring })
}

/**
 * Mirrors how the subscribers record the tracking metric: it is only
 * recorded when AI monitoring is enabled.
 *
 * @param {Config} config The agent configuration.
 * @returns {string|null} The recorded metric name, or `null` when no metric is recorded.
 */
function recordedMetric(config) {
  return config.isAiMonitoringEnabled() ? getTrackingMetricName(config, BASE_METRIC) : null
}

test('default configuration records the basic metric', () => {
  const config = Config.initialize({})
  assert.equal(recordedMetric(config), BASIC_METRIC)
})

test('supportability metric table with ai_monitoring.enabled unset', async (t) => {
  // `record_content.enabled` only takes effect when `ai_monitoring.enabled` is
  // `true`, so basic telemetry always records the `/Basic` metric, even when
  // `record_content.enabled` is `true`.
  const cases = [
    { basic: false, content: false, expected: null },
    { basic: false, content: true, expected: null },
    { basic: true, content: false, expected: BASIC_METRIC },
    { basic: true, content: true, expected: BASIC_METRIC }
  ]

  for (const { basic, content, expected } of cases) {
    await t.test(`basic_telemetry=${basic}, record_content=${content}`, () => {
      const config = buildConfig({ basic, enabled: UNSET, content })
      assert.equal(recordedMetric(config), expected)
    })
  }
})

test('ai_monitoring.enabled = true always records the base metric', async (t) => {
  for (const basic of [true, false]) {
    for (const content of [UNSET, true, false]) {
      await t.test(`basic_telemetry=${basic}, record_content=${content}`, () => {
        const config = buildConfig({ basic, enabled: true, content })
        assert.equal(recordedMetric(config), BASE_METRIC)
      })
    }
  }
})

test('ai_monitoring.enabled = false never records a metric', async (t) => {
  for (const basic of [true, false]) {
    await t.test(`basic_telemetry=${basic}`, () => {
      const config = buildConfig({ basic, enabled: false, content: UNSET })
      assert.equal(recordedMetric(config), null)
    })
  }
})
