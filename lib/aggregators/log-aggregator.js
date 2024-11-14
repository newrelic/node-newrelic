/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'logs_aggregator' })
const { isLogLabelingEnabled } = require('../../lib/util/application-logging')
const EventAggregator = require('./event-aggregator')
const parseLabels = require('../util/label-parser')

const NAMES = require('../metrics/names')

/**
 * Aggregates log events up to a certain limit.
 *
 * @private
 * @class
 */
class LogAggregator extends EventAggregator {
  constructor(opts, agent) {
    opts = opts || {}
    opts.method = opts.method || 'log_event_data'
    opts.metricNames = NAMES.LOGGING

    super(opts, agent)
    this.agent = agent
  }

  _toPayloadSync() {
    const events = this.events

    if (events.length === 0) {
      logger.debug('No log events to send.')
      return
    }

    const logs = events.toArray()

    /**
     *  Due to logging library implementation details
     *  some "log lines" are a function that formats the
     *  data accordingly into an Object, I know, this sucks.
     */
    const formattedLogs = logs
      .map((logLine) => {
        if (typeof logLine === 'function') {
          return logLine()
        }

        return logLine
      })
      .filter(Boolean)

    if (!formattedLogs.length) {
      logger.debug('No log events to send after formatting.')
      return
    }

    const commonAttrs = this.agent.getServiceLinkingMetadata()

    const payload = [
      {
        common: { attributes: commonAttrs },
        logs: formattedLogs
      }
    ]

    // exclude list needs to be case-insensitive
    const excludeSet = new Set(
      this.agent.config.application_logging.forwarding.labels.exclude.map((item) =>
        item.toLowerCase()
      )
    )

    if (isLogLabelingEnabled(this.agent.config)) {
      const configuredLabels = parseLabels(this.agent.config.labels)

      configuredLabels.forEach((label) => {
        if (!excludeSet.has(label.label_type.toLowerCase())) {
          payload[0].common.attributes[`tags.${label.label_type}`] = label.label_value
        }
      })
    }

    return payload
  }

  add(logLine) {
    const transaction = this.agent.getTransaction()
    if (transaction) {
      transaction.logs.add(logLine)
    } else {
      super.add(logLine)
    }
  }

  addBatch(logs, priority) {
    logs.forEach((logLine) => {
      super.add(logLine, priority)
    })
  }

  reconfigure(config) {
    const oldLimit = this.limit
    super.reconfigure(config)
    if (this.limit <= 0 && oldLimit > 0) {
      logger.debug('This New Relic account has disabled APM logs.')
      this.clear()
    } else if (oldLimit <= 0 && this.limit > 0) {
      logger.debug('This New Relic account has re-enabled APM logs.')
    }
  }
}

module.exports = LogAggregator
