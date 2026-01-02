/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Subscriber = require('./base')
const { isApplicationLoggingEnabled,
  isLocalDecoratingEnabled,
  isLogForwardingEnabled,
  isMetricsEnabled, createModuleUsageMetric,
  incrementLoggingLinesMetrics } = require('../util/application-logging')

class ApplicationLogsSubscriber extends Subscriber {
  constructor({ agent, logger, packageName, channelName }) {
    super({ agent, logger, packageName, channelName })
    this.requireActiveTx = false
    this.libMetricCreated = false
  }

  get enabled() {
    return super.enabled && isApplicationLoggingEnabled(this.config)
  }

  isLogForwardingEnabled() {
    return isLogForwardingEnabled(this.config, this.agent)
  }

  /**
   * The intent of this method is to create a module usage metric
   * but only once. You should call this in your handler.
   * We cannot recreate creating this metric on require of a logging library
   * because we no longer monkey patch but subscribe to events.
   * @param {string} lib name of library
   */
  createModuleUsageMetric(lib) {
    if (this.libMetricCreated === false) {
      createModuleUsageMetric(lib, this.agent.metrics)
      this.libMetricCreated = true
    }
  }

  decorateLogLine() {
    if (isLocalDecoratingEnabled(this.config)) {
      return this.agent.getNRLinkingMetadata()
    }
  }

  incrementLinesMetric(level) {
    if (isMetricsEnabled(this.config)) {
      incrementLoggingLinesMetrics(level, this.agent.metrics)
    }
  }

  forwardLogLine(data) {
    if (this.isLogForwardingEnabled()) {
      const ctx = this.agent.tracer.getContext()
      const formatLogLine = this.reformatLogLine(data, ctx)
      this.agent.logs.add(formatLogLine)
    }
  }
}

module.exports = ApplicationLogsSubscriber
