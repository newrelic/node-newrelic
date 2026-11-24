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

/**
 * Records `SubscriberUsed/<moduleName>` and, when the module version is
 * known, `SubscriberUsed/<moduleName>/<major>`. Each metric is counted once
 * per harvest.
 *
 * An unknown or invalid version only records the package metric. It never
 * falls back to the Node.js major, which would be indistinguishable from a
 * real package major (e.g. `undici/22`).
 *
 * @param {object} params Function parameters.
 * @param {object} params.agent The agent instance.
 * @param {string} params.moduleName The instrumented package name.
 * @param {string} [params.moduleVersion] The instrumented package version.
 */
function recordSupportabilityMetric({
  agent,
  moduleName,
  moduleVersion = 'unknown'
} = {}) {
  if (semver.valid(moduleVersion)) {
    incrementOnce(agent, `${SUBSCRIBER_USED}/${moduleName}/${semver.major(moduleVersion)}`)
  }
  incrementOnce(agent, `${SUBSCRIBER_USED}/${moduleName}`)
}

/**
 * Increments a metric's call count if it has not been incremented yet.
 *
 * @param {object} agent The agent instance.
 * @param {string} name The metric name.
 */
function incrementOnce(agent, name) {
  const metric = agent.metrics.getOrCreateMetric(name)
  if (metric.callCount === 0) {
    metric.incrementCallCount()
  }
}
