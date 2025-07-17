/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Subscriber = require('./base')
const { isApplicationLoggingEnabled, isLocalDecoratingEnabled, isLogForwardingEnabled, isMetricsEnabled, createModuleUsageMetric, incrementLoggingLinesMetrics } = require('../util/application-logging')

class ApplicationLogsSubscriber extends Subscriber {
  constructor(agent, id) {
    super(agent, id)
    this.requireActiveTx = false
    this.libMetricCreated = false
  }

  get enabled() {
    return isApplicationLoggingEnabled(this.config)
  }

  /**
   * The intent of this method is to create a module usage metric
   * but only once. You should call this in your handler.
   * We cannot recreate creating this metric on require of a logging library
   * because we no longer monkey patch but subscribe to events.
   * @param lib
   */
  createModuleUsageMetric(lib) {
    if (this.libMetricCreated === false) {
      createModuleUsageMetric(lib, this._agent.metrics)
      this.libMetricCreated = true
    }
  }

  decorateLogLine() {
    if (isLocalDecoratingEnabled(this.config)) {
      return this._agent.getNRLinkingMetadata()
    }
  }

  incrementLinesMetric(level) {
    if (isMetricsEnabled(this.config)) {
      incrementLoggingLinesMetrics(level, this._agent.metrics)
    }
  }

  forwardLogLine(data) {
    if (isLogForwardingEnabled(this.config, this._agent)) {
      const ctx = this._agent.tracer.getContext()
      const formatLogLine = this.reformatLogLine(data, ctx)
      this._agent.logs.add(formatLogLine)
    }
  }
}

module.exports = ApplicationLogsSubscriber
