/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NrLogger = require('./nr-logger.js')

/**
 * Implements the `@opentelemetry/api-logs` `LoggerProvider` interface.
 * Returns an `NrLogger` that routes directly to the NR emit handler.
 *
 * A distinct `NrLogger` is cached per instrumentation scope (name + version)
 * so that the emit handler can be told which scope produced a given
 * `LogRecord` -- required to populate the `otel.scope.*`/`otel.library.*`
 * log attributes. Repeated calls with the same name/version reuse the same
 * `NrLogger` instance, per the interface's "reuse Logger instances" contract.
 *
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api-logs.LoggerProvider.html
 */
class NrLoggerProvider {
  #emitHandler
  #enabledHandler
  #loggers = new Map()

  constructor(emitHandler, enabledHandler) {
    this.#emitHandler = emitHandler
    this.#enabledHandler = enabledHandler
  }

  getLogger(name, version) {
    const key = `${name}@${version ?? ''}`
    let logger = this.#loggers.get(key)
    if (logger === undefined) {
      logger = new NrLogger(this.#emitHandler, this.#enabledHandler, { name, version })
      this.#loggers.set(key, logger)
    }
    return logger
  }
}

module.exports = NrLoggerProvider
