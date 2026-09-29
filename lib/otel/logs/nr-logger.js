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
  #scope

  constructor(emitHandler, enabledHandler, scope) {
    this.#emitHandler = emitHandler
    this.#enabledHandler = enabledHandler
    this.#scope = scope
  }

  emit(logRecord) {
    this.#emitHandler(logRecord, this.#scope)
  }

  enabled() {
    return this.#enabledHandler()
  }
}

module.exports = NrLogger
