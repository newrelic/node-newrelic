/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const NAMES = require('#agentlib/metrics/names.js')
const assertMetrics = require('./assert-metrics')
const semver = require('semver')

/**
 * assertion to verify tracking metrics for a given
 * package and version are being captured
 *
 * @param {object} params params object
 * @param {string} params.pkg name of package
 * @param {string} params.version version of package
 * @param {Agent} params.agent agent instance
 * @param {object} [deps] Injected dependencies.
 * @param {object} [deps.assert] Assertion library to use.
 */
module.exports = function assertPackageMetrics(
  { pkg, version, agent },
  { assert = require('node:assert') } = {}
) {
  const metrics = [
    [{ name: `${NAMES.FEATURES.INSTRUMENTATION.ON_REQUIRE}/${pkg}` }]
  ]

  if (version) {
    metrics.push([{ name: `${NAMES.FEATURES.INSTRUMENTATION.ON_REQUIRE}/${pkg}/Version/${semver.major(version)}` }])
  }

  assertMetrics(agent.metrics, metrics, false, false, { assert })
}
