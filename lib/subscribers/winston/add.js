/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const ApplicationLogsSubscriber = require('../application-logs')

/**
 * This is the subscriber for Container.add
 * aka winston.loggers.add.
 * Format registration and NrTransport injection are handled by the
 * configure subscriber since Container.add calls createLogger()
 * which triggers Logger.configure internally.
 */
module.exports = class WinstonAdd extends ApplicationLogsSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_add', packageName: 'winston' })
  }

  /**
   * Runs before Container.add executes.
   * Records the module usage metric for winston.
   * Container.add does nothing if the logger already exists, so we
   * skip instrumentation in that case.
   */
  handler(data, ctx) {
    const { arguments: args, self: container } = data
    const id = args[0]

    // add does nothing if the logger has already been added
    if (container.loggers.has(id)) {
      return ctx
    }

    this.createModuleUsageMetric('winston')
    return ctx
  }
}
