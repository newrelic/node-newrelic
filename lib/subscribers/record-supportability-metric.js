/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = recordSupportabilityMetric

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
  const metric = agent.metrics.getOrCreateMetric(
    `${SUBSCRIBER_USED}/${moduleName}/${moduleVersion}`
  )
  metric.incrementCallCount()
}
