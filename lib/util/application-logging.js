/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const utils = module.exports
const MAX_LENGTH = 1021
const OUTPUT_LENGTH = 1024

/**
 * Truncates a string to 1021 characters
 *
 * @param {string} str string to truncate
 * @returns {string} truncated string
 */
utils.truncate = function truncate(str) {
  if (str.length > OUTPUT_LENGTH) {
    return str.substring(0, MAX_LENGTH) + '...'
  }

  return str
}

/**
 * Checks if application_logging and one of the features are enabled
 *
 * @param {object} config agent config
 * @returns {boolean} is application logging enabled
 */
utils.isApplicationLoggingEnabled = function isApplicationLoggingEnabled(config) {
  return !!(
    config.application_logging.enabled &&
    (config.application_logging.metrics.enabled ||
      config.application_logging.forwarding.enabled ||
      config.application_logging.local_decorating.enabled)
  )
}

/**
 * Checks if application_logging and application_logging.metrics are both enabled
 *
 * @param {object} config agent config
 * @returns {boolean} is metrics enabled
 */
utils.isMetricsEnabled = function isMetricsEnabled(config) {
  return !!(config.application_logging.enabled && config.application_logging.metrics.enabled)
}

/**
 * Checks if application_logging and application_logging.local_decorating are both enabled
 *
 * @param {object} config agent config
 * @returns {boolean} is local decorating enabled
 */
utils.isLocalDecoratingEnabled = function isLocalDecoratingEnabled(config) {
  return !!(
    config.application_logging.enabled && config.application_logging.local_decorating.enabled
  )
}

/**
 * Checks if log aggregator exists on agent & application_logging and application_logging.forwarding are both enabled
 *
 * @param {object} config agent config
 * @param {Agent} agent Node.js agent
 * @returns {boolean} is forwarding enabled
 */
utils.isLogForwardingEnabled = function isLogForwardingEnabled(config, agent) {
  return !!(
    agent.logs &&
    config.application_logging.enabled &&
    config.application_logging.forwarding.enabled
  )
}

/**
 * Increments both `Logging/lines` and `Logging/lines/<level>` call count
 *
 * @param {string} level log level
 * @param {object} metrics metrics module
 */
utils.incrementLoggingLinesMetrics = function incrementLoggingLinesMetrics(level, metrics) {
  metrics.getOrCreateMetric('Logging/lines').incrementCallCount()
  metrics.getOrCreateMetric(`Logging/lines/${level}`).incrementCallCount()
}

/**
 * Adds supportability metric to indicate  logging library instrumentation loaded
 * (e.g. - `Supportability/Logging/Nodejs/winston/enabled`)
 *
 * @param {object} metrics metrics module
 * @param {string} lib name of logging library
 */
utils.createModuleUsageMetric = function createModuleUsageMetric(metrics, lib) {
  metrics.getOrCreateMetric(`Supportability/Logging/Nodejs/${lib}/enabled`).incrementCallCount()
}
