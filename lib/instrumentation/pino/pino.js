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

module.exports = function instrument(shim, tools) {
  const pinoVersion = shim.pkgVersion

  if (semver.lt(pinoVersion, '7.0.0')) {
    shim.logger.debug('Instrumentation only supported on pino >=7.0.0.')
    return
  }

  const agent = shim.agent
  const config = agent.config

  if (!isApplicationLoggingEnabled(config)) {
    shim.logger.debug('Application logging not enabled. Not instrumenting pino.')
    return
  }

  const metrics = agent.metrics
  createModuleUsageMetric('pino', metrics)

  wrapAsJson({ shim, tools })
}

/**
 * Wraps `asJson` to properly decorate and forward logs
 *
 * @param {object} params to function
 * @param {Shim} params.shim instance of shim
 * @param {object} params.tools exported `pino/lib/tools`
 */
function wrapAsJson({ shim, tools }) {
  const { agent } = shim
  const { config, metrics } = agent

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
      const level = this?.levels?.labels?.[args[2]]
      // Pino log methods accept a singular object (a merging object) that can
      // have a `msg` property for the log message. In such cases, we need to
      // update that log property instead of the second parameter.
      const useMergeObj = args[1] === undefined && Object.hasOwn(args[0], 'msg')

      if (isMetricsEnabled(config)) {
        incrementLoggingLinesMetrics(level, metrics)
      }

      if (isLocalDecoratingEnabled(config)) {
        if (useMergeObj === true) {
          args[0].msg += agent.getNRLinkingMetadata()
        } else {
          args[1] += agent.getNRLinkingMetadata()
        }
      }

      /**
       * must call original asJson to allow pino
       * to construct the entire log line before we
       * add to the log aggregator
       */
      const logLine = asJson.apply(this, args)

      if (isLogForwardingEnabled(config, agent)) {
        const formatLogLine = reformatLogLine({
          msg: useMergeObj === true ? args[0].msg : args[1],
          logLine,
          agent,
          level,
          logger: shim.logger
        })

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
 * @param {object} params to function
 * @param {object} params.logLine log line
 * @param {string} params.msg message of log line
 * @param {object} params.agent instance of agent
 * @param {string} params.level log level
 * @param {object} params.logger instance of agent logger
 * @returns {function} wrapped log formatter function
 */
function reformatLogLine({ logLine, msg, agent, level, logger }) {
  const metadata = agent.getLinkingMetadata(true)

  const agentMeta = Object.assign({}, { timestamp: Date.now() }, metadata)
  // eslint-disable-next-line eqeqeq
  if (msg != undefined) {
    // The spec lists `message` as "MUST" under the required column, but then
    // details that it "MUST be omitted" if the value is "empty". Additionally,
    // if someone has logged only a merging object, and that object contains a
    // message key, we do not want to overwrite their value. See issue 2595.
    agentMeta.message = msg
  }

  /**
   * A function that gets executed in `_toPayloadSync` of log aggregator.
   * This will parse the serialized log line and then add the relevant NR
   * context metadata and rename the time/msg keys to timestamp/message
   */
  return function formatLogLine() {
    let formattedLog
    try {
      formattedLog = JSON.parse(logLine)
    } catch (err) {
      logger.error('Failed to parse log line as json: %s', err.message)
      return
    }

    if (formattedLog.err) {
      reformatError(formattedLog)
    }
    Object.assign(formattedLog, agentMeta)
    formattedLog.level = level
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
