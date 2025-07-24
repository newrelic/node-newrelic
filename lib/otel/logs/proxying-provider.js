/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const symLogPatched = Symbol('nr.log.patched')

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

    // Logger has already been patched, so just return it.
    if (logger[symLogPatched] === true) {
      return logger
    }

    logger.emit = function nrEmitWrapper(record) {
      handler(record)
      return emit.apply(this, arguments)
    }

    logger[symLogPatched] = true
    return logger
  }
}

module.exports = NewRelicLoggerProvider
