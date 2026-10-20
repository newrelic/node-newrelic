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

test('supportability metric table', async (t) => {
  // No metric when AI monitoring is disabled, `/Basic` when it is enabled
  // without content, and the base metric when content is recorded.
  const cases = [
    { enabled: false, basic: true, content: true, expected: null },
    { enabled: false, basic: false, content: UNSET, expected: null },
    { enabled: UNSET, basic: false, content: true, expected: null },
    { enabled: UNSET, basic: false, content: UNSET, expected: null },
    { enabled: UNSET, basic: true, content: UNSET, expected: BASIC_METRIC },
    { enabled: UNSET, basic: true, content: false, expected: BASIC_METRIC },
    { enabled: UNSET, basic: true, content: true, expected: BASE_METRIC },
    { enabled: true, basic: true, content: UNSET, expected: BASE_METRIC },
    { enabled: true, basic: false, content: UNSET, expected: BASE_METRIC },
    { enabled: true, basic: false, content: true, expected: BASE_METRIC },
    { enabled: true, basic: true, content: false, expected: BASIC_METRIC },
    { enabled: true, basic: false, content: false, expected: BASIC_METRIC }
  ]

  for (const { enabled, basic, content, expected } of cases) {
    await t.test(`enabled=${enabled}, basic_telemetry=${basic}, record_content=${content}`, () => {
      const config = buildConfig({ basic, enabled, content })
      assert.equal(recordedMetric(config), expected)
    })
  }
})

test('collect_ai = false records no metric', () => {
  const config = buildConfig({ basic: true, enabled: true, content: true })
  config.onConnect({ collect_ai: false })
  assert.equal(recordedMetric(config), null)
})
