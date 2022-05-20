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
 * @param root0
 * @param root0.opts
 * @param root0.config
 * @param root0.agent
 * @param root0.winston
 */
function registerFormatter({ opts, config, agent, winston }) {
  const instrumentedFormatter = nrWinstonFormatter(agent, winston)

  if ('transports' in opts) {
    opts.transports = opts.transports.map((transport) => {
      if (transport.format) {
        transport.format = winston.format.combine(transport.format, instrumentedFormatter())
      } else {
        transport.format = instrumentedFormatter()
      }
      return transport
    })
  } else if ('format' in opts) {
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
 * @param agent
 * @param winston
 */
function nrWinstonFormatter(agent, winston) {
  const config = agent.config
  const metrics = agent.metrics
  createModuleUsageMetric(metrics, 'winston')

  const jsonFormatter = winston.format.json()

  return winston.format((info, opts) => {
    if (isMetricsEnabled(config)) {
      incrementLoggingLinesMetrics(info.level, metrics)
    }

    if (isLogForwardingEnabled(config, agent)) {
      const metadata = agent.getLinkingMetadata()
      reformatLogLine(info, metadata, agent)
      agent.logs.add(info)
    } else if (isLocalDecoratingEnabled(config)) {
      info.message += agent.getNRLinkingMetadata()
    }

    return jsonFormatter.transform(info, opts)
  })
}

/**
 * Reformats a log line by reformatting errors, timestamp and adding
 * new relic linking metadata(context)
 *
 * @param {object} info log line
 * @param {object} metadata linking metadata
 * @param {object} newrelic API instance
 * @param agent
 */
function reformatLogLine(info, metadata, agent) {
  if (info.exception === true) {
    reformatError(info)
  }

  reformatTimestamp(info, agent)

  // Add the metadata to the info object being logged
  Object.assign(info, metadata)
}

/**
 * Decorates the log line with  truncated error.message, error.class, and error.stack and removes
 * trace and stack
 *
 * @param {object} info a log line
 */
function reformatError(info) {
  // Due to Winston internals sometimes the error on the info object is a string or an
  // empty object, and so the message property is all we have
  const errorMessage = info.error.message || info.message || ''

  info['error.message'] = truncate(errorMessage)
  info['error.class'] = info.error.name === 'Error' ? info.error.constructor.name : info.error.name
  info['error.stack'] = truncate(info.error.stack)
  info.message = truncate(info.message)

  // Removes additional capture of stack to reduce overall payload/log-line size.
  // The server has a maximum of ~4k characters per line allowed.
  delete info.trace
  delete info.stack
}

/**
 * Turns timestamp into unix timestamp. If timestamp existed it will move original
 * to `original_timestamp` key
 *
 * @param info
 */
function reformatTimestamp(info) {
  if (info.timestamp) {
    logger.traceOnce(
      'Overwriting `timestamp` key; assigning original value to `original_timestamp`.'
    )
    info.original_timestamp = info.timestamp
  }
  info.timestamp = Date.now()
}

/**
 * winston allows you to compose a logger
 * from an instantiated logger.  Through a series
 * of inherited classes, this logger instance is a Stream.
 * Check what gets passed into `winston.createLogger` to avoid
 * instrumenting an already instrumented instance of a logger.
 *
 * @param {*} obj obj to check if a stream
 * @returns {boolean}
 */
function isStream(obj) {
  return obj instanceof Stream
}
