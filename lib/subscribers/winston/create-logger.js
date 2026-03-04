/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const ApplicationLogsSubscriber = require('../application-logs')

/**
 * This is the subscriber for DerivedLogger.constructor
 * aka winston.createLogger.
 * Format registration and NrTransport injection are handled by the
 * configure subscriber since Logger.constructor calls this.configure()
 * internally.
 */
module.exports = class WinstonCreateLogger extends ApplicationLogsSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_createLogger', packageName: 'winston' })
  }

  /**
   * Runs before the DerivedLogger constructor executes.
   * Records the module usage metric for winston.
   */
  handler(data, ctx) {
    this.createModuleUsageMetric('winston')
    return ctx
  }
}
