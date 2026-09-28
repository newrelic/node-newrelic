/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Implements the `@opentelemetry/api-logs` `Logger` interface. Calls the
 * provided emit handler directly, eliminating the need for
 * `@opentelemetry/sdk-logs` scaffolding.
 *
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api-logs.Logger.html
 */
class NrLogger {
  #emitHandler
  #enabledHandler

  constructor(emitHandler, enabledHandler) {
    this.#emitHandler = emitHandler
    this.#enabledHandler = enabledHandler
  }

  emit(logRecord) {
    this.#emitHandler(logRecord)
  }

  enabled() {
    return this.#enabledHandler()
  }
}

module.exports = NrLogger
