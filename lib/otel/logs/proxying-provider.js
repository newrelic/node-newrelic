/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Provides a logger provider that proxies to another logger provider.
 * This allows us to intercept loggers as they are retrieved so that we can
 * patch their `emit` method to do what we need.
 *
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api-logs.LoggerProvider.html
 */
class NewRelicLoggerProvider {
  #provider
  #emitHandler

  constructor({ provider, emitHandler }) {
    this.#provider = provider
    this.#emitHandler = emitHandler
  }

  getLogger(name, version, options) {
    const logger = this.#provider.getLogger(name, version, options)
    const emit = logger.emit
    const handler = this.#emitHandler

    logger.emit = function nrEmitWrapper(record) {
      handler(record)
      emit.call(logger, record)
    }

    return logger
  }
}

module.exports = NewRelicLoggerProvider
