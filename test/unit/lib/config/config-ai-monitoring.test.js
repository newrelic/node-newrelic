/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const Config = require('#agentlib/config/index.js')
const getTrackingMetricName = require('#agentlib/llm-events/get-tracking-metric-name.js')

const UNSET = 'unset'
const ANY = 'any'

// Each row of the "Default AIM Data Collection" precedence table that does not
// set the deprecated `ai_monitoring.enabled`. `any` values are verified against
// every possible value of that setting.
const PRECEDENCE_TABLE = [
  { basic: false, content: ANY, sent: false, withContent: false },
  { basic: true, content: UNSET, sent: true, withContent: false },
  { basic: true, content: false, sent: true, withContent: false },
  { basic: true, content: true, sent: true, withContent: true }
]

/**
 * Builds an agent configuration through the real config loader so that
 * `unset` values receive their actual schema defaults.
 *
 * @param {object} params The configuration values for the row.
 * @param {boolean} [params.enabled] The value of the deprecated `ai_monitoring.enabled`, if set.
 * @param {boolean} params.basic The value of `ai_monitoring.basic_telemetry.enabled`.
 * @param {boolean|string} params.content The value of `ai_monitoring.record_content.enabled`, or `unset`.
 * @returns {Config} The agent configuration.
 */
function buildConfig({ enabled, basic, content }) {
  const aiMonitoring = { basic_telemetry: { enabled: basic } }
  if (enabled !== undefined) {
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
    const { basic, content, sent, withContent } = row
    await t.test(`basic_telemetry=${basic}, record_content=${content}`, () => {
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
  // explicit opt-out for `ai_monitoring.record_content.enabled`.
  const config = Config.initialize({
    ai_monitoring: { record_content: { enabled: null } }
  })
  assert.strictEqual(config.ai_monitoring.record_content.enabled, null)
  assert.equal(config.isAiMonitoringEnabled(), true)
  assert.equal(config.shouldRecordAiContent(), false)
})

test('environment variables are coerced to booleans', async (t) => {
  const vars = [
    'NEW_RELIC_AI_MONITORING_BASIC_TELEMETRY_ENABLED',
    'NEW_RELIC_AI_MONITORING_RECORD_CONTENT_ENABLED'
  ]
  t.afterEach(() => {
    for (const name of vars) delete process.env[name]
  })

  for (const value of [true, false]) {
    await t.test(`${value}`, () => {
      for (const name of vars) process.env[name] = `${value}`
      const config = Config.initialize({})
      assert.strictEqual(config.ai_monitoring.basic_telemetry.enabled, value)
      assert.strictEqual(config.ai_monitoring.record_content.enabled, value)
    })
  }
})

test('ai_monitoring.enabled behavior until removal', async (t) => {
  const ENV_VAR = 'NEW_RELIC_AI_MONITORING_ENABLED'

  /**
   * Asserts the deprecation was emitted exactly once as a process
   * `DeprecationWarning`. The message itself is verified in `config.test.js`.
   *
   * @param {object} ctx The test context.
   */
  function assertEmitted(ctx) {
    assert.equal(ctx.nr.emitWarning.callCount, 1)
    assert.equal(ctx.nr.emitWarning.firstCall.args[1], 'DeprecationWarning')
  }

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.emitWarning = sinon.stub(process, 'emitWarning')
  })

  t.afterEach((ctx) => {
    ctx.nr.emitWarning.restore()
    delete process.env[ENV_VAR]
  })

  // Rows of the "Default AIM Data Collection" precedence table that set
  // `ai_monitoring.enabled`. An explicit value wins over
  // `ai_monitoring.basic_telemetry.enabled`.
  const precedenceTable = [
    { enabled: false, basic: ANY, content: ANY, sent: false, withContent: false },
    // `record_content.enabled` is forced to `true` when it is unset.
    { enabled: true, basic: ANY, content: UNSET, sent: true, withContent: true },
    { enabled: true, basic: ANY, content: true, sent: true, withContent: true },
    { enabled: true, basic: ANY, content: false, sent: true, withContent: false }
  ]
  for (const row of precedenceTable.flatMap(expand)) {
    const { enabled, basic, content, sent, withContent } = row
    await t.test(`precedence: enabled=${enabled}, basic_telemetry=${basic}, record_content=${content}`, (t) => {
      const config = buildConfig(row)
      assert.equal(config.isAiMonitoringEnabled(), sent, 'isAiMonitoringEnabled')
      assert.equal(config.shouldRecordAiContent(), withContent, 'shouldRecordAiContent')
      assertEmitted(t)
    })
  }

  // No metric when AI monitoring is disabled, `/Basic` when it is enabled
  // without content, and the base metric when content is recorded.
  const BASE_METRIC = 'Supportability/Nodejs/ML/OpenAI/4.0.0'
  const BASIC_METRIC = `${BASE_METRIC}/Basic`
  const metricTable = [
    { enabled: false, basic: true, content: true, expected: null },
    { enabled: false, basic: false, content: UNSET, expected: null },
    { enabled: true, basic: true, content: UNSET, expected: BASE_METRIC },
    { enabled: true, basic: false, content: UNSET, expected: BASE_METRIC },
    { enabled: true, basic: false, content: true, expected: BASE_METRIC },
    { enabled: true, basic: true, content: false, expected: BASIC_METRIC },
    { enabled: true, basic: false, content: false, expected: BASIC_METRIC }
  ]
  for (const row of metricTable) {
    const { enabled, basic, content, expected } = row
    await t.test(`supportability metric: enabled=${enabled}, basic_telemetry=${basic}, record_content=${content}`, (t) => {
      const config = buildConfig(row)
      const metric = config.isAiMonitoringEnabled()
        ? getTrackingMetricName(config, BASE_METRIC)
        : null
      assert.equal(metric, expected)
      assertEmitted(t)
    })
  }

  for (const enabled of [true, false]) {
    await t.test(`should send \`ai_monitoring.enabled\` in public settings when set to ${enabled}`, (t) => {
      const config = Config.initialize({ ai_monitoring: { enabled } })
      assert.equal(config.publicSettings()['ai_monitoring.enabled'], enabled)
      assertEmitted(t)
    })
  }

  for (const enabled of [true, false]) {
    await t.test(`should coerce the environment variable value \`'${enabled}'\` to a boolean`, (t) => {
      process.env[ENV_VAR] = `${enabled}`
      const config = Config.initialize({})
      assert.strictEqual(config.ai_monitoring.enabled, enabled)
      assert.equal(config.isAiMonitoringEnabled(), enabled)
      assertEmitted(t)
    })
  }

  await t.test('should force content on when set to true locally before connect', (t) => {
    const config = new Config({ ai_monitoring: { enabled: true } })
    config.onConnect({ agent_config: { 'ai_monitoring.streaming.enabled': true } })
    assert.equal(config.shouldRecordAiContent(), true)
    assertEmitted(t)
  })

  await t.test('should not force content on when the connect response also sends it', (t) => {
    // Any `ai_monitoring.enabled` from the connect response cancels forcing,
    // even when it matches the local value.
    const config = new Config({ ai_monitoring: { enabled: true } })
    config.onConnect({ agent_config: { 'ai_monitoring.enabled': true } })
    assert.equal(config.isAiMonitoringEnabled(), true)
    assert.equal(config.shouldRecordAiContent(), false)
    assertEmitted(t)
  })

  await t.test('should force content on again when a later connect omits it', (t) => {
    const config = new Config({ ai_monitoring: { enabled: true } })
    config.onConnect({ agent_config: { 'ai_monitoring.enabled': true } })
    assert.equal(config.shouldRecordAiContent(), false)
    config.onConnect({ agent_config: {} })
    assert.equal(config.shouldRecordAiContent(), true)
    assertEmitted(t)
  })

  await t.test('should not let SSC basic_telemetry override a local false', (t) => {
    const config = new Config({ ai_monitoring: { enabled: false } })
    config.onConnect({ agent_config: { 'ai_monitoring.basic_telemetry.enabled': true } })
    assert.equal(config.isAiMonitoringEnabled(), false)
    assertEmitted(t)
  })

  await t.test('should be forced off by high security mode', (t) => {
    const config = Config.initialize({ high_security: true, ai_monitoring: { enabled: true } })
    assert.equal(config.ai_monitoring.enabled, false)
    assert.equal(config.isAiMonitoringEnabled(), false)
    assertEmitted(t)
  })
})
