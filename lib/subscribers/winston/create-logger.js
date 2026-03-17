/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const ApplicationLogsSubscriber = require('../application-logs')

/**
 * This is the subscriber for `DerviedLogger.constructor`.
 *
 * Handles NR formatter registration (after `DerviedLogger.constructor` runs, via `end`).
 */
module.exports = class WinstonCreateLogger extends ApplicationLogsSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_createLogger', packageName: 'winston' })
    this.events = ['end']
  }

  end(data) {
    const self = this
    const logger = data.self
    if (this.isLocalDecoratingEnabled() || this.isMetricsEnabled()) {
      /**
       * This formatter is being used to facilitate
       * the two application logging use cases: metrics and local log decorating.
       *
       * Local log decorating appends `NR-LINKING` piped metadata to
       * the message key in log line. You must configure a log forwarder to get
       * this data to NR1.
       */
      const transform = logger.format.transform
      logger.format.transform = function wrappedTransform(logLine) {
        self.incrementLinesMetric(logLine.level)

        if (self.isLocalDecoratingEnabled()) {
          logLine.message += self.agent.getNRLinkingMetadata()
        }
        return transform.apply(this, arguments)
      }
    }
  }
}
