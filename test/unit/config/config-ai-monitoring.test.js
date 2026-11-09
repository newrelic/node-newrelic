/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const Config = require('../../../lib/config')

const UNSET = 'unset'
const ANY = 'any'

// Each row of the "Default AIM Data Collection" precedence table. `any`
// values are verified against every possible value of that setting.
const PRECEDENCE_TABLE = [
  { enabled: false, basic: ANY, content: ANY, sent: false, withContent: false },
  { enabled: UNSET, basic: false, content: ANY, sent: false, withContent: false },
  { enabled: UNSET, basic: true, content: UNSET, sent: true, withContent: false },
  { enabled: UNSET, basic: true, content: false, sent: true, withContent: false },
  { enabled: UNSET, basic: true, content: true, sent: true, withContent: true },
  // `record_content.enabled` is forced to `true` when it is unset.
  { enabled: true, basic: ANY, content: UNSET, sent: true, withContent: true },
  { enabled: true, basic: ANY, content: true, sent: true, withContent: true },
  { enabled: true, basic: ANY, content: false, sent: true, withContent: false }
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
 * Expands `any` values into one row per possible value of that setting.
 *
 * @param {object} row A row from the precedence table.
 * @returns {object[]} The rows to verify.
 */
function expand(row) {
  const basics = row.basic === ANY ? [true, false] : [row.basic]
  const contents = row.content === ANY ? [UNSET, true, false] : [row.content]
  return basics.flatMap((basic) => contents.map((content) => {
    return { ...row, basic, content }
  }))
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
  assert.equal(config.ai_monitoring.record_content.enabled, null)
  assert.equal(config.isAiMonitoringEnabled(), true)
  assert.equal(config.shouldRecordAiContent(), false)
})

test('explicit `null` values are treated as unset', () => {
  // Schema validation must not coerce `null` to `false`, which would be an
  // explicit opt-out for `ai_monitoring.enabled`.
  const config = Config.initialize({
    ai_monitoring: { enabled: null, record_content: { enabled: null } }
  })
  assert.strictEqual(config.ai_monitoring.enabled, null)
  assert.strictEqual(config.ai_monitoring.record_content.enabled, null)
  assert.equal(config.isAiMonitoringEnabled(), true)
  assert.equal(config.shouldRecordAiContent(), false)
})

test('environment variables are coerced to booleans', async (t) => {
  const vars = ['NEW_RELIC_AI_MONITORING_ENABLED', 'NEW_RELIC_AI_MONITORING_RECORD_CONTENT_ENABLED']
  t.afterEach(() => {
    for (const name of vars) delete process.env[name]
  })

  for (const value of [true, false]) {
    await t.test(`${value}`, () => {
      for (const name of vars) process.env[name] = `${value}`
      const config = Config.initialize({})
      assert.strictEqual(config.ai_monitoring.enabled, value)
      assert.strictEqual(config.ai_monitoring.record_content.enabled, value)
    })
  }
})
