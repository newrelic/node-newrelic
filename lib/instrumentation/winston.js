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
  incrementLoggingLinesMetrics
} = require('../util/application-logging')

const logger = require('../logger').child({ component: 'winston' })
const NrTransport = require('./nr-winston-transport')

module.exports = function instrument(agent, winston, _, shim) {
  const config = agent.config

  if (!isApplicationLoggingEnabled(config)) {
    logger.debug('Application logging not enabled. Not instrumenting winston.')
    return
  }

  shim.wrap(winston, 'createLogger', function wrapCreate(shim, createLogger) {
    return function wrappedCreateLogger() {
      const args = shim.argsToArray.apply(shim, arguments)
      const opts = args[0] || {}
      if (isStream(opts)) {
        return createLogger.apply(this, args)
      }
      return performInstrumentation({
        obj: this,
        args,
        opts,
        agent,
        winston,
        registerLogger: createLogger
      })
    }
  })

  shim.wrap(winston.loggers, 'add', function wrapAdd(shim, add) {
    return function wrappedAdd() {
      const args = shim.argsToArray.apply(shim, arguments)
      const id = args[0]
      const opts = args[1] || {}
      // add does nothing if the logger has already been added, so we
      // have to do the same nothingness here.
      const alreadyAdded = this.loggers.has(id)
      if (alreadyAdded || isStream(opts)) {
        return add.apply(this, args)
      }
      return performInstrumentation({
        obj: this,
        args,
        opts,
        agent,
        winston,
        registerLogger: add
      })
    }
  })
}

function performInstrumentation({ obj, args, opts, agent, winston, registerLogger }) {
  const config = agent.config

  createModuleUsageMetric('winston', agent.metrics)

  if (isLocalDecoratingEnabled(config) || isMetricsEnabled(config)) {
    registerFormatter({ opts, agent, winston })
  }

  const winstonLogger = registerLogger.apply(obj, args)

  if (isLogForwardingEnabled(config, agent)) {
    winstonLogger.add(new NrTransport({ agent }))
  }

  return winstonLogger
}

/**
 * Apply a formatter to keep track of logging metrics, and in the case of local decorating appending
 * the NR-LINKING metadata to message.  We want to do this first so any formatter that is transforming
 * data will have the changes.
 *
 * @param {object} params object passed to function
 * @param {object} params.opts options from winston.createLogger
 * @param {object} params.agent NR agent
 * @param {object} params.winston exported winston package
 */
function registerFormatter({ opts, agent, winston }) {
  const instrumentedFormatter = nrWinstonFormatter(agent, winston)

  if (opts.format) {
    opts.format = winston.format.combine(instrumentedFormatter(), opts.format)
  } else {
    opts.format = instrumentedFormatter()
  }
}

/**
 * This formatter is being used to facilitate
 * the two application logging use cases: metrics and local log decorating.
 *
 * Local log decorating appends `NR-LINKING` piped metadata to
 * the message key in log line. You must configure a log forwarder to get
 * this data to NR1.
 *
 * @param {object} agent NR agent
 * @param {object} winston exported winston package
 * @returns {object} log line NR-LINKING metadata on message when local log decorating is enabled
 */
function nrWinstonFormatter(agent, winston) {
  const config = agent.config
  const metrics = agent.metrics

  return winston.format((logLine) => {
    if (isMetricsEnabled(config)) {
      incrementLoggingLinesMetrics(logLine.level, metrics)
    }

    if (isLocalDecoratingEnabled(config)) {
      logLine.message += agent.getNRLinkingMetadata()
    }

    return logLine
  })
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
