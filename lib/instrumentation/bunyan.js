/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  isApplicationLoggingEnabled,
  isLogForwardingEnabled,
  isLocalDecoratingEnabled,
  isMetricsEnabled,
  createModuleUsageMetric,
  incrementLoggingLinesMetrics
} = require('../util/application-logging')

const MAX_LENGTH = 1021
const OUTPUT_LENGTH = 1024
const truncate = (str) => {
  if (str && str.length > OUTPUT_LENGTH) {
    return str.substring(0, MAX_LENGTH) + '...'
  }

  return str
}

const logger = require('../logger').child({ component: 'bunyan' })

module.exports = function instrument(agent, bunyan, _, shim) {
  const config = agent.config

  if (!isApplicationLoggingEnabled(config)) {
    logger.debug('Application logging not enabled. Not instrumenting bunyan.')
    return
  }

  const logForwardingEnabled = isLogForwardingEnabled(config, agent)
  const metricsEnabled = isMetricsEnabled(config)

  if (logForwardingEnabled || metricsEnabled) {
    shim.wrap(bunyan, 'createLogger', function wrapCreateLogger(_shim, createLogger) {
      return function wrappedCreateLogger() {
        createModuleUsageMetric('bunyan', agent.metrics)

        const bunyanLogger = createLogger.apply(this, arguments)

        if (logForwardingEnabled) {
          bunyanLogger.addStream({
            type: 'raw',
            level: bunyanLogger.level(),
            stream: {
              write: function nrLogWrite(logLine) {
                agent.logs.add(logLine)
              }
            }
          })
        }
        return bunyanLogger
      }
    })
  }

  const localDecoratingEnabled = isLocalDecoratingEnabled(config)

  shim.wrap(bunyan.prototype, '_emit', function wrapEmit(shim, emit) {
    return function wrappedEmit() {
      const args = shim.argsToArray.apply(shim, arguments)
      const rec = args[0] || {}

      if (metricsEnabled) {
        incrementLoggingLinesMetrics(bunyan.nameFromLevel[rec.level], agent.metrics)
      }

      if (!localDecoratingEnabled && !logForwardingEnabled) {
        return emit.apply(this, arguments)
      }

      // timestamp needs to be milliseconds since epoch
      if (rec.timestamp) {
        logger.traceOnce(
          'Overwriting `timestamp` key; assigning original value to `original_timestamp`.'
        )
        rec.original_timestamp = rec.timestamp
      }
      rec.timestamp = Date.now()

      // put log message into a consistent spot and ensure it's not too long
      rec.message = truncate(rec.msg)
      rec.msg = '' // this allows the CLI pretty-printing to continue working, for the most part

      // tidy up the error output to help with max length restrictions
      if (rec.err) {
        rec['error.message'] = truncate(rec.err.message)
        rec['error.stack'] = truncate(rec.err.stack)
        rec['error.class'] = rec.err.name === 'Error' ? rec.err.constructor.name : rec.err.name
        // clear out the old error message
        delete rec.err
      }

      // Add the metadata to the object being logged
      const metadata = agent.getLinkingMetadata(true)
      Object.keys(metadata).forEach((m) => {
        rec[m] = metadata[m]
      })
      return emit.apply(this, [rec, args[1]])
    }
  })
}
