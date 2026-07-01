/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * A logger that conforms to Open Telemetry's diagnostics logger interface
 * and forwards those logs to an internal agent logger instance.
 *
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_sdk-node._opentelemetry_api.DiagLogger.html
 */
class NrOtelDiagLogger {
  #logger

  /**
   * @param {object} params Constructor parameters.
   * @param {AgentLogger} params.logger Agent logger instance to forward
   * OTEL diagnostics logs to.
   */
  constructor({ logger }) {
    this.#logger = logger
  }

  debug(msg, ...args) {
    this.#logger.debug(msg, ...args)
  }

  error(msg, ...args) {
    this.#logger.error(msg, ...args)
  }

  info(msg, ...args) {
    this.#logger.info(msg, ...args)
  }

  verbose(msg, ...args) {
    this.#logger.trace(msg, ...args)
  }

  warn(msg, ...args) {
    this.#logger.warn(msg, ...args)
  }
}

module.exports = NrOtelDiagLogger
