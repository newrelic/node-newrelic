/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { PROFILING } = require('../metrics/names.js')

/**
 * Increments the enabled or disabled metrics for the profiling feature:
 * - Supportability/Nodejs/Profiling/<enabled|disabled>
 *
 * @param {Agent} agent instance
 */
function createProfilingFlagMetric(agent) {
  const { config, metrics } = agent
  if (config.profiling.enabled) {
    metrics.getOrCreateMetric(PROFILING.PREFIX + 'enabled').incrementCallCount()
  } else {
    metrics.getOrCreateMetric(PROFILING.PREFIX + 'disabled').incrementCallCount()
  }
}

/**
 * If profiling is enabled, increments the metrics for heap and cpu profilers if they are included in the config:
 * - Supportability/Nodejs/Profiling/Heap
 * - Supportability/Nodejs/Profiling/Cpu
 *
 * @param {Agent} agent instance
 */
function createProfilingTypeMetrics(agent) {
  const { config, metrics } = agent
  if (!config.profiling.enabled) {
    return
  }

  if (config.profiling.include.includes('heap')) {
    metrics.getOrCreateMetric(PROFILING.PREFIX + PROFILING.HEAP).incrementCallCount()
  }

  if (config.profiling.include.includes('cpu')) {
    metrics.getOrCreateMetric(PROFILING.PREFIX + PROFILING.CPU).incrementCallCount()
  }
}

/**
 * Increments the metrics for profiling duration:
 * - Supportability/Nodejs/Profiling/Duration
 *
 * @param {Metrics} metrics instance
 * @param {number} durationInMillis duration in milliseconds
 */
function createProfilingDurationMetric(metrics, durationInMillis) {
  metrics.measureMilliseconds(PROFILING.PREFIX + PROFILING.DURATION, null, durationInMillis)
}

/**
 * Increments the metrics for startup profiling. These metrics are for whether profiling is enabled/disabled
 * and which profilers are enabled.
 * - Supportability/Nodejs/Profiling/<enabled|disabled>
 * - Supportability/Nodejs/Profiling/Heap
 * - Supportability/Nodejs/Profiling/Cpu
 *
 * @param {Agent} agent instance
 */
function createStartupProfilingMetrics(agent) {
  createProfilingFlagMetric(agent)
  createProfilingTypeMetrics(agent)
}

module.exports = {
  createProfilingFlagMetric,
  createProfilingDurationMetric,
  createStartupProfilingMetrics
}
