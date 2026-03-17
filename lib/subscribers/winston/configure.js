/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const ApplicationLogsSubscriber = require('../application-logs')
const NrTransport = require('./nr-winston-transport.js')

/**
 * This is the subscriber for `Logger.configure`.
 * `Logger.constructor` calls `this.configure(options)`, so this fires
 * during initial construction and on any subsequent reconfiguration.
 *
 * Handles `NrTransport` injection (after `configure` runs, via `end`).
 */
module.exports = class WinstonConfigure extends ApplicationLogsSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_configure', packageName: 'winston' })
    this.events = ['end']
  }

  handler(data, ctx) {
    this.createModuleUsageMetric('winston')
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
}
