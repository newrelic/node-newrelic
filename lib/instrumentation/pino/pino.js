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

  /**
   * Creates an object where the keys are the level labels and values are the level number.
   * Pino passes in level as number but our spec needs it to be the label
   */
  const levelMap = Object.entries(levelUtils.levels).reduce((levels, level) => {
    const [label, number] = level
    levels[number] = label
    return levels
  }, {})

  const symbols = shim.require('./lib/symbols')

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
      const args = shim.argsToArray.apply(shim, arguments)

      if (isMetricsEnabled(config)) {
        const level = args[2]
        incrementLoggingLinesMetrics(levelMap[level], metrics)
      }

      if (isLocalDecoratingEnabled(config)) {
        args[1] += agent.getNRLinkingMetadata()
      }

      /**
       * must call original asJson to allow pino
       * to construct the entire log line before we
       * add to the log aggregator
       */
      const logLine = asJson.apply(this, args)

      if (isLogForwardingEnabled(config, agent)) {
        const chindings = this[symbols.chindingsSym]
        const formatLogLine = reformatLogLine({ msg: args[1], logLine, agent, chindings, levelMap })

        agent.logs.add(formatLogLine)
      }

      return logLine
    }
  })
}

/**
 * reformats error and assigns NR context data
 * to log line
 *
 * @param logLine.logLine
 * @param {object} logLine log line
 * @param {object} metadata NR context data
 * @param {string} chindings serialized string of all common log line data
 * @param logLine.args
 * @param logLine.agent
 * @param logLine.chindings
 * @param logLine.msg
 * @param logLine.levelMap
 */
function reformatLogLine({ logLine, msg, agent, chindings = '', levelMap }) {
  const metadata = agent.getLinkingMetadata()

  /**
   * pino adds this already for us at times
   * since asJson manually constructs the json string,
   * it will have hostname twice if we do not delete ours.
   */
  if (chindings.includes('hostname')) {
    delete metadata.hostname
  }

  const agentMeta = Object.assign({}, { timestamp: Date.now(), message: msg }, metadata)

  /**
   * A function that gets executed in `_toPayloadSync` of log aggregator.
   * This will parse the serialized log line and then add the relevant NR
   * context metadata and rename the time/msg keys to timestamp/message
   */
  return function formatLogLine() {
    const formattedLog = JSON.parse(logLine)
    if (formattedLog.err) {
      reformatError(formattedLog)
    }
    Object.assign(formattedLog, agentMeta)
    formattedLog.level = levelMap[formattedLog.level]
    delete formattedLog.time
    delete formattedLog.msg
    return formattedLog
  }
}

/**
 * Truncates the message, stack and class of error
 * and reassigns to a `error.*` keyspace. Also removes the `err`
 * key on a log line
 *
 * @param {object} logLine log line
 */
function reformatError(logLine) {
  logLine['error.message'] = truncate(logLine.err.message)
  logLine['error.stack'] = truncate(logLine.err.stack)
  logLine['error.class'] = logLine.err.type
  delete logLine.err
}
