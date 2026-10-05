/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const {
  extractLlmAttributes,
  extractLlmContext,
  getTrackingMetricName,
  isAiMonitoringEnabled,
  shouldRecordAiContent
} = require('../../../lib/util/llm-utils')
const Config = require('../../../lib/config')
const { AsyncLocalStorage } = require('node:async_hooks')

const UNSET = 'unset'
const NA = 'N/A'
const BASE_METRIC = 'Supportability/Nodejs/ML/OpenAI/4.0.0'
const BASIC_METRIC = `${BASE_METRIC}/Basic`

// Each row of the `ai_monitoring` configuration precedence table, with the
// tracking metric expected for that row. `N/A` rows are verified against
// every possible `record_content.enabled` value.
const PRECEDENCE_TABLE = [
  { basic: true, enabled: UNSET, content: NA, sent: true, withContent: false, metric: BASIC_METRIC },
  { basic: true, enabled: true, content: UNSET, sent: true, withContent: true, metric: BASE_METRIC },
  { basic: true, enabled: true, content: true, sent: true, withContent: true, metric: BASE_METRIC },
  { basic: true, enabled: true, content: false, sent: true, withContent: false, metric: BASE_METRIC },
  { basic: true, enabled: false, content: NA, sent: false, withContent: false, metric: null },
  { basic: false, enabled: UNSET, content: NA, sent: false, withContent: false, metric: null },
  { basic: false, enabled: true, content: UNSET, sent: true, withContent: true, metric: BASE_METRIC },
  { basic: false, enabled: true, content: true, sent: true, withContent: true, metric: BASE_METRIC },
  { basic: false, enabled: true, content: false, sent: true, withContent: false, metric: BASE_METRIC },
  { basic: false, enabled: false, content: NA, sent: false, withContent: false, metric: null }
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
 * Mirrors how the subscribers record the tracking metric: it is only
 * recorded when AI monitoring is enabled.
 *
 * @param {Config} config The agent configuration.
 * @returns {string|null} The recorded metric name, or `null` when no metric is recorded.
 */
function recordedMetric(config) {
  return isAiMonitoringEnabled(config) ? getTrackingMetricName(config, BASE_METRIC) : null
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
    const { basic, enabled, content, sent, withContent, metric } = row
    await t.test(`basic_telemetry=${basic}, enabled=${enabled}, record_content=${content}`, () => {
      const config = buildConfig(row)
      assert.equal(isAiMonitoringEnabled(config), sent, 'isAiMonitoringEnabled')
      assert.equal(shouldRecordAiContent(config), withContent, 'shouldRecordAiContent')
      assert.equal(recordedMetric(config), metric, 'tracking metric')
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
  assert.equal(isAiMonitoringEnabled(config), true)
  assert.equal(shouldRecordAiContent(config), false)
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

test('extractLlmAttributes', () => {
  const context = {
    skip: 1,
    'llm.get': 2,
    'fllm.skip': 3
  }

  const llmContext = extractLlmAttributes(context)
  assert.ok(!llmContext.skip)
  assert.ok(!llmContext['fllm.skip'])
  assert.equal(llmContext['llm.get'], 2)
})

test('extractLlmContext', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const tx = {
      _llmContextManager: new AsyncLocalStorage()
    }
    ctx.nr.agent = {
      tracer: {
        getTransaction: () => tx
      }
    }
    ctx.nr.tx = tx
  })

  await t.test('handle empty context', (t, end) => {
    const { tx, agent } = t.nr
    tx._llmContextManager.run(null, () => {
      const llmContext = extractLlmContext(agent)
      assert.equal(typeof llmContext, 'object')
      assert.equal(Object.entries(llmContext).length, 0)
      end()
    })
  })

  await t.test('extract LLM context', (t, end) => {
    const { tx, agent } = t.nr
    tx._llmContextManager.run({ 'llm.test': 1, skip: 2 }, () => {
      const llmContext = extractLlmContext(agent)
      assert.equal(llmContext['llm.test'], 1)
      assert.ok(!llmContext.skip)
      end()
    })
  })

  await t.test('no transaction', (t, end) => {
    const { tx, agent } = t.nr
    agent.tracer.getTransaction = () => null
    tx._llmContextManager.run(null, () => {
      const llmContext = extractLlmContext(agent)
      assert.equal(typeof llmContext, 'object')
      assert.equal(Object.entries(llmContext).length, 0)
      end()
    })
  })
})
