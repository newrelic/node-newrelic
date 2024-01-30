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
      // re-assign the first arg to an object if does not exist so we can assign the default formatter
      const opts = (args[0] = args[0] || {})
      if (isStream(opts)) {
        return createLogger.apply(this, args)
      }
      return performInstrumentation({
        obj: this,
        args,
        opts,
        agent,
        winston,
        shim,
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
        shim,
        registerLogger: add
      })
    }
  })
}

/**
 * Does the necessary instrumentation depending on application_logging configuration.
 * It will register a formatter to track metrics or decorate message in formatter(if local log decoration)
 * and register a transport do to the log fowarding
 *
 * @param {object} params object passed to function
 * @param {object} params.obj instance of winston logger
 * @param {Array} params.args arguments passed to the logger creation method(createLogger or logger.add)
 * @param {object} params.opts the logger options argument
 * @param {Agent} params.agent NR instance
 * @param {object} params.winston the winston export
 * @param {Shim} params.shim shim instance
 * @param {Function} params.registerLogger the function to create winston logger
 * @returns {object} the winston logger instance with relevant instrumentation
 */
function performInstrumentation({ obj, args, opts, agent, winston, shim, registerLogger }) {
  const config = agent.config

  createModuleUsageMetric('winston', agent.metrics)

  if (isLocalDecoratingEnabled(config) || isMetricsEnabled(config)) {
    registerFormatter({ opts, agent, winston })
  }

  const winstonLogger = registerLogger.apply(obj, args)

  if (isLogForwardingEnabled(config, agent)) {
    winstonLogger.add(new NrTransport({ agent }))
    wrapConfigure({ shim, winstonLogger, agent })
  }

  return winstonLogger
}

/**
 * Wraps logger.configure and checks the transports key in the arguments and adds the NrTransport as
 * it will get cleared in configure.
 *
 * @param {object} params object passed to function
 * @param {object} params.shim shim instance
 * @param {object} params.winstonLogger instance of logger
 * @param {object} params.agent NR agent
 */
function wrapConfigure({ shim, winstonLogger, agent }) {
  shim.wrap(winstonLogger, 'configure', function nrConfigure(shim, configure) {
    return function wrappedConfigure() {
      const args = shim.argsToArray.apply(shim, arguments)
      const transportsArg = args?.[0]?.transports
      if (this.transports.length) {
        const nrTransport = new NrTransport({ agent })
        args[0].transports = Array.isArray(transportsArg)
          ? [...transportsArg, nrTransport]
          : nrTransport
      }
      return configure.apply(this, args)
    }
  })
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
    // The default formatter for Winston is the JSON formatter. If the user
    // has not provided a formatter through opts.format, we must emulate the
    // default. Otherwise, the message symbol will not get attached to log
    // messages and transports, e.g. the "Console" transport, will not be able
    // to output logs correctly.
    opts.format = winston.format.combine(instrumentedFormatter(), winston.format.json())
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
