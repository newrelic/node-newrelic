/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const utils = module.exports
const MAX_LENGTH = 1021
const OUTPUT_LENGTH = 1024
const { LOGGING } = require('../metrics/names')

/**
 * Truncates a string to MAX_LENGTH constant above.
 *
 * @param {string} str string to truncate
 * @returns {string}
 */
utils.truncate = function truncate(str) {
  if (typeof str === 'string' && str.length > OUTPUT_LENGTH) {
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
 * @returns {boolean} is forwarding enabled
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
 * Checks if application_logging.forwarding.labels is enabled
 *
 * @param {object} config agent config
 * @returns {boolean} is labeling enabled
 */
utils.isLogLabelingEnabled = function isLogLabelingEnabled(config) {
  return !!config.application_logging.forwarding.labels.enabled
}

/**
 * Increments both `Logging/lines` and `Logging/lines/<level>` call count
 *
 * @param {string} level log level
 * @param {object} metrics metrics module
 */
utils.incrementLoggingLinesMetrics = function incrementLoggingLinesMetrics(level, metrics) {
  const levelMetric = getLogLevel(level)

  metrics.getOrCreateMetric(LOGGING.LINES).incrementCallCount()
  metrics.getOrCreateMetric(levelMetric).incrementCallCount()
}

/**
 * Increments call count when instrumentation for a logging library is loaded
 *
 * @param {string} lib name of library
 * @param {object} metrics agent metrics instance
 */
utils.createModuleUsageMetric = function createModuleUsageMetric(lib, metrics) {
  metrics.getOrCreateMetric(LOGGING.LIBS[lib.toUpperCase()]).incrementCallCount()
}

function getLogLevel(level) {
  if (!level) {
    return LOGGING.LEVELS.UNKNOWN
  }
  const logLevel = LOGGING.LEVELS[level.toUpperCase()]
  if (!logLevel) {
    return LOGGING.LEVELS.UNKNOWN
  }
  return logLevel
}

/**
 * Increments the enabled/disabled metrics for the top line application logging features:
 *  1. Supportability/Logging/Metrics/Nodejs/<enabled|disabled>
 *  2. Supportability/Logging/Forwarding/Nodejs/<enabled|disabled>
 *  3. Supportability/Logging/LocalDecorating/Nodejs/<enabled|disabled>
 *  4. Supportability/Logging/Labels/Nodejs/<enabled|disabled>
 *
 *  Run in `agent.onConnect`
 *
 * @param {Agent} agent instance
 */
utils.createFeatureUsageMetrics = function createFeatureUsageMetrics(agent) {
  const { config, metrics } = agent
  const loggingConfig = config.application_logging.enabled
  metrics
    .getOrCreateMetric(
      `${LOGGING.METRICS}${
        loggingConfig && config.application_logging.metrics.enabled ? 'enabled' : 'disabled'
      }`
    )
    .incrementCallCount()
  metrics
    .getOrCreateMetric(
      `${LOGGING.FORWARDING}${
        loggingConfig && config.application_logging.forwarding.enabled ? 'enabled' : 'disabled'
      }`
    )
    .incrementCallCount()
  metrics
    .getOrCreateMetric(
      `${LOGGING.LOCAL_DECORATING}${
        loggingConfig && config.application_logging.local_decorating.enabled
          ? 'enabled'
          : 'disabled'
      }`
    )
    .incrementCallCount()
  metrics
    .getOrCreateMetric(
      `${LOGGING.LABELS}${
        loggingConfig && config.application_logging.forwarding.labels.enabled
          ? 'enabled'
          : 'disabled'
      }`
    )
    .incrementCallCount()
}
