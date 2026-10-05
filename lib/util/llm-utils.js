/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Determines if AI monitoring is enabled, i.e. whether or not `Llm*` events,
 * spans, and metrics should be sent, according to the
 * `ai_montioring.basic_telemetry.enabled` vs. `ai_monitoring.enabled`
 * precedence table in the LLMs.md spec.
 * @param {object} config The agent configuration.
 * @returns {boolean} `true` if AI monitoring is enabled, `false` otherwise.
 */
function isAiMonitoringEnabled(config) {
  const aiConfig = config.ai_monitoring
  if (aiConfig.enabled === true) return true
  if (aiConfig.enabled === false) return false
  return aiConfig.basic_telemetry.enabled === true
}

/**
 * Determines if `Llm*` events, spans, and metrics should be sent with content
 * (e.g. the `input` field in a `LlmEmbedding` event).
 * @param {object} config The agent configuraiton.
 * @returns {boolean} `true` if `Llm*` events, spans, and metrics should be
 * sent with content, `false` otherwise.
 */
function shouldRecordAiContent(config) {
  const aiConfig = config.ai_monitoring
  return aiConfig.enabled === true && aiConfig.record_content.enabled !== false
}

/**
 * Builds the name of the LLM tracking metric. When `ai_monitoring.enabled` is
 * unset and basic telemetry is enabled, the metric is suffixed with `/Basic`,
 * e.g. `Supportability/Nodejs/ML/OpenAI/4.0.0/Basic`.
 *
 * @param {object} config The agent configuration.
 * @param {string} trackingMetric The base tracking metric, e.g. `Supportability/Nodejs/ML/OpenAI/4.0.0`.
 * @returns {string} The tracking metric name to record.
 */
function getTrackingMetricName(config, trackingMetric) {
  // `ai_monitoring.enabled = true` always emits the base metric, regardless of
  // `basic_telemetry` or `record_content`.
  const aiConfig = config.ai_monitoring
  if (aiConfig.enabled !== true && aiConfig.basic_telemetry?.enabled === true) {
    return `${trackingMetric}/Basic`
  }
  return trackingMetric
}

/**
 * Extract LLM attributes from the LLM context
 *
 * @param {object} context LLM context object
 * @returns {object} LLM custom attributes
 */
function extractLlmAttributes(context) {
  return Object.keys(context).reduce((result, key) => {
    if (key.indexOf('llm.') === 0) {
      result[key] = context[key]
    }
    return result
  }, {})
}

/**
 * Extract LLM context from the active transaction
 *
 * @param {Agent} agent NR agent instance
 * @returns {object} LLM context object
 */
function extractLlmContext(agent) {
  const context = agent.tracer.getTransaction()?._llmContextManager?.getStore() || {}
  return extractLlmAttributes(context)
}

exports = module.exports = { extractLlmContext, extractLlmAttributes, getTrackingMetricName, isAiMonitoringEnabled, shouldRecordAiContent }
