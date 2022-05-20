/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Stream = require('stream')
const {
  isApplicationLoggingEnabled,
  isLogForwardingEnabled,
  isLocalDecoratingEnabled,
  isMetricsEnabled,
  createModuleUsageMetric,
  incrementLoggingLinesMetrics,
  truncate
} = require('../util/application-logging')
const logger = require('../logger').child({ component: 'winston' })

module.exports = function instrument(agent, winston, _, shim) {
  const config = agent.config

  if (!isApplicationLoggingEnabled(config)) {
    logger.debug('Application logging not enabled. Not instrumenting winston.')
    return
  }

  shim.wrap(winston, 'createLogger', function wrapCreate(shim, createLogger) {
    return function createWrappedLogger() {
      const args = shim.argsToArray.apply(shim, arguments)
      const opts = args[0]
      if (!shim.isObject(opts) || isStream(opts)) {
        return createLogger.apply(this, args)
      }

      registerFormatter({ opts, config, agent, winston })

      return createLogger.apply(this, args)
    }
  })
}

/**
 * There is no right way to do this.  But since we are automagical
 * it is hard to predict how a customer uses winston.  We will iterate over the formatters specified on the logger and add last if forwarder or first if local decorating.
 * This is because we want all the customizations of previous formatters before adding log log to log aggregator.  But in the case of local decorating we want to do this first so any formatter that is transforming data will have the changes.
 *
 * Note: The logic explained above does not apply if a customer specifies multiple formats for a given transport.
 * We cannot instrument the formats on the transport because if a customer has multiple transports we would be duplicating logs when forwaring.
 *
 * @param {object} params object passed to function
 * @param {object} params.opts options from winston.createLogger
 * @param {object} params.config agent config
 * @param {object} params.agent NR agent
 * @param {object} params.winston exported winston package
 */
function registerFormatter({ opts, config, agent, winston }) {
  const instrumentedFormatter = nrWinstonFormatter(agent, winston)

  if ('format' in opts) {
    const formatters = [opts.format]

    if (isLogForwardingEnabled(config, agent)) {
      formatters.push(instrumentedFormatter())
    } else {
      formatters.unshift(instrumentedFormatter())
    }

    opts.format = winston.format.combine(...formatters)
  } else {
    opts.format = instrumentedFormatter()
  }
}

/**
 * This formatter is being used to facilitate
 * the application logging use cases.
 * It is worth noting that the features below are mutually
 * exclusive.
 *
 * The application logging use cases are local log decorating
 * and log forwarding.
 *
 * Local log decorating appends `NR-LINKING` piped metadata to
 * the message key in log line. You must configure a log forwarder to get
 * this data to NR1.
 *
 * Log forwarding includes the linking metadata as keys on logging
 * object as well as adds the log line to the agent log aggregator.
 *
 * @param {object} agent NR agent
 * @param {object} winston exported winston package
 * @returns {object} log line with NR context or NR-LINKING metadata on message
 */
function nrWinstonFormatter(agent, winston) {
  const config = agent.config
  const metrics = agent.metrics
  createModuleUsageMetric('winston', metrics)

  return winston.format((logLine) => {
    if (isMetricsEnabled(config)) {
      incrementLoggingLinesMetrics(logLine.level, metrics)
    }

    if (isLogForwardingEnabled(config, agent)) {
      const metadata = agent.getLinkingMetadata()
      reformatLogLine(logLine, metadata, agent)
      agent.logs.add(logLine)
    } else if (isLocalDecoratingEnabled(config)) {
      logLine.message += agent.getNRLinkingMetadata()
    }

    return logLine
  })
}

/**
 * Reformats a log line by reformatting errors, timestamp and adding
 * new relic linking metadata(context)
 *
 * @param {object} logLine log line
 * @param {object} metadata linking metadata
 * @param {object} agent NR agent
 */
function reformatLogLine(logLine, metadata, agent) {
  if (logLine.exception === true) {
    reformatError(logLine)
  }

  reformatTimestamp(logLine, agent)

  // Add the metadata to the logLine object being logged
  Object.assign(logLine, metadata)
}

/**
 * Decorates the log line with  truncated error.message, error.class, and error.stack and removes
 * trace and stack
 *
 * @param {object} logLine a log line
 */
function reformatError(logLine) {
  // Due to Winston internals sometimes the error on the logLine object is a string or an
  // empty object, and so the message property is all we have
  const errorMessage = logLine.error.message || logLine.message || ''

  logLine['error.message'] = truncate(errorMessage)
  logLine['error.class'] =
    logLine.error.name === 'Error' ? logLine.error.constructor.name : logLine.error.name
  logLine['error.stack'] = truncate(logLine.error.stack)
  logLine.message = truncate(logLine.message)

  // Removes additional capture of stack to reduce overall payload/log-line size.
  // The server has a maximum of ~4k characters per line allowed.
  delete logLine.trace
  delete logLine.stack
}

/**
 * Turns timestamp into unix timestamp. If timestamp existed it will move original
 * to `original_timestamp` key
 *
 * @param {object} logLine a log line
 */
function reformatTimestamp(logLine) {
  if (logLine.timestamp) {
    logger.traceOnce(
      'Overwriting `timestamp` key; assigning original value to `original_timestamp`.'
    )
    logLine.original_timestamp = logLine.timestamp
  }
  logLine.timestamp = Date.now()
}

/**
 * winston allows you to compose a logger
 * from an instantiated logger.  Through a series
 * of inherited classes, this logger instance is a Stream.
 * Check what gets passed into `winston.createLogger` to avoid
 * instrumenting an already instrumented instance of a logger.
 *
 * @param {*} obj obj to check if a stream
 * @returns {boolean} is object is a stream or not
 */
function isStream(obj) {
  return obj instanceof Stream
}
