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
 *
 * @property {boolean} handlingExceptions Indicates if this instrumentation has
 * already registered a global exception handler or not. We only need a single
 * exception handler per process.
 */
module.exports = class WinstonConfigure extends ApplicationLogsSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_configure', packageName: 'winston' })
    this.events = ['end']
    // we only want to assign `handleExceptions` to the first NrTransport
    // customers could be constructing multiple logger instances
    this.handlingExceptions = false
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
      // assigning `transport.handleExceptions` adds a global `process.on('uncaughtException')`
      // handler. Doing it for more than one NrTransport instance will cause duplicate log lines
      if (this.handlingExceptions === false && logger.transports.length > 0) {
        // See: https://github.com/winstonjs/winston#handling-uncaught-exceptions-with-winston
        nrTransport.handleExceptions = true
        this.handlingExceptions = true
      }
      logger.add(nrTransport)
    }
  }
}
