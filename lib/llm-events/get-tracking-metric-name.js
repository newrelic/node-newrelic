/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = getTrackingMetricName

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
