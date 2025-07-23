/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const symLogSeen = Symbol('nr.log.seen')

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
      if (record[symLogSeen] === true) {
        // When an application is not directly using the OTEL logs API itself,
        // but is instead utilizing a logging library that has been
        // instrumented by an OTEL instrumentation, we can see the same `record`
        // more than once. This is because the OTEL instrumentation internally
        // utilize the logs API to ship the log records. So, we must tag the
        // records and look for that tag. Otherwise, we will end up enqueuing
        // the same record multiple times to be shipped to New Relic.
        return
      }
      record[symLogSeen] = true
      handler(record)
      emit.call(logger, record)
    }

    return logger
  }
}

module.exports = NewRelicLoggerProvider
