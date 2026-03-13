/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const ApplicationLogsSubscriber = require('../application-logs')
const NrTransport = require('./nr-winston-transport.js')
const { format } = require('logform')

/**
 * This is the subscriber for Logger.configure.
 * Logger.constructor calls this.configure(options), so this fires
 * during initial construction and on any subsequent reconfiguration.
 *
 * Handles both:
 * - NR formatter registration (before configure runs, via handler)
 * - NrTransport injection (after configure runs, via end)
 */
module.exports = class WinstonConfigure extends ApplicationLogsSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_configure', packageName: 'winston' })
    this.events = ['end']
  }

  /**
   * Runs before Logger.configure executes.
   * Registers the NR formatter on opts so configure sets this.format correctly.
   * This works for both initial construction and reconfiguration since
   * configure() always sets this.format from the options.
   * @param {object} data event data
   * @param {Context} ctx active context
   */
  handler(data, ctx) {
    const { arguments: args } = data
    const opts = (args[0] = args[0] || {})

    this.createModuleUsageMetric('winston')

    if (this.isLocalDecoratingEnabled() || this.isMetricsEnabled()) {
      this.#registerFormatter({ opts })
    }
    return ctx
  }

  /**
   * Runs after Logger.configure completes.
   * Adds NrTransport if not already present.
   *
   * @param {object} data event data
   */
  end(data) {
    const logger = data.self
    if (!this.isLogForwardingEnabled()) {
      return
    }

    const hasNrTransport = logger.transports?.some((t) => t.name === 'newrelic')
    if (!hasNrTransport) {
      const nrTransport = new NrTransport({ agent: this.agent })
      // Only handle exceptions if the logger has user-configured transports.
      // This prevents the default logger (created during require('winston')
      // module init with no transports) from double-handling exceptions.
      if (logger.transports.length === 0) {
        nrTransport.handleExceptions = false
      }
      logger.add(nrTransport)
    }
  }

  /**
   * Apply a formatter to keep track of logging metrics, and in the case of local decorating appending
   * the NR-LINKING metadata to message.  We want to do this first so any formatter that is transforming
   * data will have the changes.
   *
   * @param {object} params object passed to function
   * @param {object} params.opts options from configure()
   */
  #registerFormatter({ opts }) {
    const instrumentedFormatter = this.#nrWinstonFormatter(format)

    if (opts.format) {
      opts.format = format.combine(instrumentedFormatter(), opts.format)
    } else {
      // The default formatter for Winston is the JSON formatter. If the user
      // has not provided a formatter through opts.format, we must emulate the
      // default. Otherwise, the message symbol will not get attached to log
      // messages and transports, e.g. the "Console" transport, will not be able
      // to output logs correctly.
      opts.format = format.combine(instrumentedFormatter(), format.json())
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
   * @param {object} format logform.format aka winston.format
   * @returns {object} log line NR-LINKING metadata on message when local log decorating is enabled
   */
  #nrWinstonFormatter(format) {
    return format((logLine) => {
      this.incrementLinesMetric(logLine.level)

      if (this.isLocalDecoratingEnabled()) {
        logLine.message += this.agent.getNRLinkingMetadata()
      }

      return logLine
    })
  }
}
