/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const Config = require('../../../lib/config')

const UNSET = 'unset'
const NA = 'N/A'

// Each row of the `ai_monitoring` configuration precedence table. `N/A` rows
// are verified against every possible `record_content.enabled` value.
const PRECEDENCE_TABLE = [
  { basic: true, enabled: UNSET, content: NA, sent: true, withContent: false },
  { basic: true, enabled: true, content: UNSET, sent: true, withContent: true },
  { basic: true, enabled: true, content: true, sent: true, withContent: true },
  { basic: true, enabled: true, content: false, sent: true, withContent: false },
  { basic: true, enabled: false, content: NA, sent: false, withContent: false },
  { basic: false, enabled: UNSET, content: NA, sent: false, withContent: false },
  { basic: false, enabled: true, content: UNSET, sent: true, withContent: true },
  { basic: false, enabled: true, content: true, sent: true, withContent: true },
  { basic: false, enabled: true, content: false, sent: true, withContent: false },
  { basic: false, enabled: false, content: NA, sent: false, withContent: false }
]

/**
 * Builds an agent configuration through the real config loader so that
 * `unset` values receive their actual schema defaults.
 *
 * @param {object} params The configuration values for the row.
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
 * Expands `N/A` rows into one row per possible `record_content.enabled` value.
 *
 * @param {object} row A row from the precedence table.
 * @returns {object[]} The rows to verify.
 */
function expand(row) {
  if (row.content !== NA) {
    return [row]
  }
  return [UNSET, true, false].map((content) => {
    return { ...row, content }
  })
}

test('ai_monitoring configuration precedence', async (t) => {
  for (const row of PRECEDENCE_TABLE.flatMap(expand)) {
    const { basic, enabled, content, sent, withContent } = row
    await t.test(`basic_telemetry=${basic}, enabled=${enabled}, record_content=${content}`, () => {
      const config = buildConfig(row)
      assert.equal(config.isAiMonitoringEnabled(), sent, 'isAiMonitoringEnabled')
      assert.equal(config.shouldRecordAiContent(), withContent, 'shouldRecordAiContent')
    })
  }
})

test('default configuration sends basic telemetry without content', () => {
  const config = Config.initialize({})
  assert.equal(config.ai_monitoring.basic_telemetry.enabled, true)
  assert.equal(config.ai_monitoring.enabled, null)
  // `record_content.enabled` defaults to `true` but only takes effect when
  // `ai_monitoring.enabled` is explicitly `true`.
  assert.equal(config.ai_monitoring.record_content.enabled, true)
  assert.equal(config.isAiMonitoringEnabled(), true)
  assert.equal(config.shouldRecordAiContent(), false)
})
