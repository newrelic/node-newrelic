/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = recordSupportabilityMetric

const semver = require('semver')
const {
  FEATURES: {
    INSTRUMENTATION: { SUBSCRIBER_USED }
  }
} = require('#agentlib/metrics/names.js')

function recordSupportabilityMetric({
  agent,
  moduleName,
  moduleVersion = 'unknown'
} = {}) {
  const major = moduleVersion === 'unknown'
    ? semver.major(process.version)
    : semver.major(moduleVersion)

  let metric = agent.metrics.getOrCreateMetric(
    `${SUBSCRIBER_USED}/${moduleName}/${major}`
  )
  if (metric.callCount === 0) {
    metric.incrementCallCount()
  }

  metric = agent.metrics.getOrCreateMetric(
    `${SUBSCRIBER_USED}/${moduleName}`
  )
  if (metric.callCount === 0) {
    metric.incrementCallCount()
  }
}
