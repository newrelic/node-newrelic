/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = getTrackingMetricName

/**
 * Builds the name of the LLM tracking metric. When content is not being
 * recorded, the metric is suffixed with `/Basic`, e.g.
 * `Supportability/Nodejs/ML/OpenAI/4.0.0/Basic`. Callers only record the
 * metric when AI monitoring is enabled.
 *
 * @param {object} config The agent configuration.
 * @param {string} trackingMetric The base tracking metric, e.g. `Supportability/Nodejs/ML/OpenAI/4.0.0`.
 * @returns {string} The tracking metric name to record.
 */
function getTrackingMetricName(config, trackingMetric) {
  return config.shouldRecordAiContent() ? trackingMetric : `${trackingMetric}/Basic`
}
