/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { PROFILING } = require('../metrics/names.js')

function createProfilingFlag(agent) {
  const { config, metrics } = agent
  if (config.profiling.enabled) {
    metrics.getOrCreateMetric(PROFILING.PREFIX + 'enabled').incrementCallCount()
  } else {
    metrics.getOrCreateMetric(PROFILING.PREFIX + 'disabled').incrementCallCount()
  }
}

function createProfilingType(agent) {
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

function createProfilingDuration(metrics, durationInMillis) {
  metrics.measureMilliseconds(PROFILING.PREFIX + PROFILING.DURATION, null, durationInMillis)
}

function createStartupProfilingMetrics(agent) {
  createProfilingFlag(agent)
  createProfilingType(agent)
}

module.exports = {
  createProfilingFlag,
  createProfilingDuration,
  createStartupProfilingMetrics
}
