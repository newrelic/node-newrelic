/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { PROFILING } = require('../metrics/names.js')

/**
 * Increments the enabled or disabled metrics for profiling.
 *
 * Run in `agent.onConnect`
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
 * If profiling ie enabled, increments the metrics for heap and cpu profilers if they are included in the config.
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
 * Increments the metrics for profiling duration.
 *
 * Run in `agent.onConnect`
 *
 * @param {*} metrics instance
 * @param {*} durationInMillis duration in milliseconds
 */
function createProfilingDurationMetric(metrics, durationInMillis) {
  metrics.measureMilliseconds(PROFILING.PREFIX + PROFILING.DURATION, null, durationInMillis)
}

/**
 * Increments the metrics for startup profiling. These metrics are for whether profiling is enabled/disabled
 * and which profilers are enabled.
 *
 * Run in `agent.onConnect`
 *
 * @param {Agent} agent instance
 */
function createStartupProfilingMetrics(agent) {
  createProfilingFlagMetric(agent)
  createProfilingTypeMetrics(agent)
}

module.exports = {
  createProfilingFlag,
  createProfilingDuration,
  createStartupProfilingMetrics
}
