/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  createModuleUsageMetric,
  isApplicationLoggingEnabled,
  isLogForwardingEnabled,
  isMetricsEnabled,
  isLocalDecoratingEnabled,
  incrementLoggingLinesMetrics,
  truncate
} = require('../../util/application-logging')
const semver = require('semver')

module.exports = function instrument(shim) {
  const pinoVersion = shim.require('./package.json').version

  if (semver.lt(pinoVersion, '7.0.0')) {
    shim.logger.debug('Instrumentation only supported on pino >=7.0.0.')
    return
  }

  const tools = shim.require('./lib/tools')
  const agent = shim.agent
  const config = agent.config

  if (!isApplicationLoggingEnabled(config)) {
    shim.logger.debug('Application logging not enabled. Not instrumenting pino.')
    return
  }

  const metrics = agent.metrics
  createModuleUsageMetric('pino', metrics)

  const levelUtils = shim.require('./lib/levels')

  // Create a where the keys are the numbers and the values are the labels
  const levelMap = Object.entries(levelUtils.levels).reduce((prev, current) => {
    const [key, value] = current
    prev[value] = key
    return prev
  }, {})

  const symbols = shim.require('./lib/symbols')

  /**
   * Wraps the level cache so we can properly set a formatter to return the
   * label as level in log line instead of number
   */
  shim.wrap(levelUtils, 'genLsCache', function genLsCache(shim, genLevelsCache) {
    return function wrappedGenLsCache() {
      const args = shim.argsToArray.apply(shim, arguments)
      args[0][symbols.formattersSym].level = function nrLevelMapping(label) {
        return { level: label }
      }
      return genLevelsCache.apply(this, args)
    }
  })

  shim.wrap(tools, 'asJson', function wrapJson(shim, asJson) {
    /**
     * Wraps function in pino that is used to construct/serialize a log
     * line to json
     *
     * @param {object} obj data from mixins
     * @param {string} msg message of log line
     * @param {number} num log level as number
     * @param {string} time formatted snippet of json with time(`,"time":<unix time>`)
     * @returns {string} serialized log line
     */
    return function wrappedAsJson() {
      // overriding the symbol that defines the key for message(pino defaults this to `msg`)
      this[symbols.messageKeySym] = 'message'

      const args = shim.argsToArray.apply(shim, arguments)

      // changing the timestamp from time to timestamp
      args[3] = `,"timestamp":${Date.now()}`

      if (isMetricsEnabled(config)) {
        const level = args[2]
        incrementLoggingLinesMetrics(levelMap[level], metrics)
      }

      if (isLogForwardingEnabled(config, agent)) {
        const metadata = agent.getLinkingMetadata()
        reformatLogLine(args[0], metadata)
      } else if (isLocalDecoratingEnabled(config)) {
        args[1] += agent.getNRLinkingMetadata()
      }

      const info = asJson.apply(this, args)

      if (isLogForwardingEnabled(config, agent)) {
        agent.logs.add(info)
      }

      return info
    }
  })
}

/**
 * reformats error and assigns NR context data
 * to log line
 *
 * @param {object} info log line
 * @param {object} metadata NR context data
 */
function reformatLogLine(info, metadata) {
  if (info.err) {
    reformatError(info)
  }

  Object.assign(info, metadata)
}

/**
 * Truncates the message, stack and class of error
 * and reassigns to a `error.*` keyspace. Also removes the `err`
 * key on a log line
 *
 * @param {object} info log line
 */
function reformatError(info) {
  info['error.message'] = truncate(info.err.message)
  info['error.stack'] = truncate(info.err.stack)
  info['error.class'] = info.err.name === 'Error' ? info.err.constructor.name : info.err.name
  delete info.err
}

