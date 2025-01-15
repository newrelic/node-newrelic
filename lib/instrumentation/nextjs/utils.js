/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const semver = require('semver')
const utils = module.exports

/**
 * Adds the relevant CLM attrs(code.function and code.filepath) to span if
 * code_level_metrics.enabled is true and if span exists
 *
 * Note: This is not like the other in agent CLM support.  Next.js is very rigid
 * with its file structure and function names. We're providing relative paths to Next.js files
 * based on the Next.js page.  The function is also hardcoded to align with the conventions of Next.js.
 *
 * @param {Object} config agent config
 * @param {TraceSegment} segment active segment to add CLM attrs to
 * @param {Object} attrs list of CLM attrs to add to segment
 */
utils.assignCLMAttrs = function assignCLMAttrs(config, segment, attrs) {
  // config is optionally accessed because agent could be older than
  // when this configuration option was defined
  if (!(config?.code_level_metrics?.enabled && segment)) {
    return
  }

  for (const [key, value] of Object.entries(attrs)) {
    segment.addAttribute(key, value)
  }
}

// Version middleware is stable
// See: https://nextjs.org/docs/advanced-features/middleware
const MIN_MW_SUPPORTED_VERSION = '12.2.0'
// Middleware moved to worker thread
// We plan on revisiting when we release a stable version of our Next.js instrumentation
const MAX_MW_SUPPORTED_VERSION = '13.4.12'

utils.MAX_MW_SUPPORTED_VERSION = MAX_MW_SUPPORTED_VERSION
utils.MIN_MW_SUPPORTED_VERSION = MIN_MW_SUPPORTED_VERSION
/**
 * Middleware instrumentation has had quite the journey for us.
 * As of 8/7/23 it no longer functions because it is running in a worker thread.
 * Our instrumentation cannot propagate context in threads so for now we will no longer record this
 * span.
 *
 * @param {string} version next.js version
 * @returns {boolean} is middleware instrumentation supported
 */
utils.isMiddlewareInstrumentationSupported = function isMiddlewareInstrumentationSupported(
  version
) {
  return (
    semver.gte(version, MIN_MW_SUPPORTED_VERSION) && semver.lte(version, MAX_MW_SUPPORTED_VERSION)
  )
}
