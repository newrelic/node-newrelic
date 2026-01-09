/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')
const assertMetrics = require('./assert-metrics')

const {
  FEATURES: {
    INSTRUMENTATION: {
      SUBSCRIBER_USED,
      ON_REQUIRE
    }
  }
} = require('#agentlib/metrics/names.js')

/**
 * assertion to verify tracking metrics for a given
 * package and version are being captured
 *
 * @param {object} params params object
 * @param {string} params.pkg name of package
 * @param {string} params.version version of package
 * @param {Agent} params.agent agent instance
 * @param {boolean} params.subscriberType When true, the metrics are expected
 * to have been generated from a subscriber based instrumentation. Otherwise,
 * the metrics are expected to be generated from a shimmer based
 * instrumentation.
 * @param {object} [deps] Injected dependencies.
 * @param {object} [deps.assert] Assertion library to use.
 */
module.exports = function assertPackageMetrics(
  { pkg, version, agent, subscriberType = false },
  { assert = require('node:assert') } = {}
) {
  const metrics = []
  const prefix = subscriberType === true
    ? `${SUBSCRIBER_USED}/${pkg}`
    : `${ON_REQUIRE}/${pkg}`

  metrics.push([{ name: prefix }])
  if (version) {
    const major = semver.major(version)
    const suffix = subscriberType === true
      ? `/${major}`
      : `/Version/${major}`
    metrics.push([{ name: `${prefix}${suffix}` }])
  }

  assertMetrics(agent.metrics, metrics, false, false, { assert })
}
