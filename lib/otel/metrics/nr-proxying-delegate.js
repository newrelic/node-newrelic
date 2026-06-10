/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { ExportResultCode } = require('@opentelemetry/core')
const defaultLogger = require('#agentlib/logger.js').child({
  component: 'nr-proxying-delegate'
})

/**
 * A wrapper over a standard OpenTelemetry "delegate" (thing that does the
 * actual work of sending and receiving data to/from a collector) so that we
 * can write an audit log when the export has completed.
 */
class NRProxyingDelegate {
  #agent
  #logger
  #wrappedDelegate

  /**
   * @param {object} delegateToProxy OTEL delegate instance that does the
   * actual data exporting work.
   * @param {object} deps Local dependency injections.
   * @param {object} deps.agent Current agent instance.
   * @param {AgentLogger} deps.logger Agent logger instance.
   */
  constructor(delegateToProxy, { agent, logger = defaultLogger } = {}) {
    this.#wrappedDelegate = delegateToProxy
    this.#agent = agent
    this.#logger = logger.child({ subcomponent: this.constructor.name })
  }

  export(items, resultCallback) {
    this.#wrappedDelegate.export(items, (result) => {
      this.#logger.audit('Received metrics export result code: %s', result.code)

      switch (result.code) {
        case ExportResultCode.SUCCESS: {
          this.#agent.metrics
            .getOrCreateMetric('Supportability/Metrics/Nodejs/OpenTelemetryBridge/export/success')
            .incrementCallCount()
          break
        }

        case ExportResultCode.FAILED: {
          this.#agent.metrics
            .getOrCreateMetric('Supportability/Metrics/Nodejs/OpenTelemetryBridge/export/failure')
            .incrementCallCount()
          break
        }
      }

      resultCallback(result)
    })
  }

  forceFlush() {
    return this.#wrappedDelegate.forceFlush()
  }

  shutdown() {
    return this.#wrappedDelegate.shutdown()
  }
}

module.exports = NRProxyingDelegate
