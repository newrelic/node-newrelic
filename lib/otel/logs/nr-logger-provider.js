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
 * `getLogger` always returns the same `NrLogger` instance regardless of the
 * name/version/options it's called with, since `NrLogger` never varies its
 * behavior by instrumentation scope -- there is no per-scope config to keep
 * separate, so a single shared instance satisfies the interface's
 * "reuse Logger instances" contract without needing a scope-keyed cache.
 *
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api-logs.LoggerProvider.html
 */
class NrLoggerProvider {
  #logger

  constructor(emitHandler, enabledHandler) {
    this.#logger = new NrLogger(emitHandler, enabledHandler)
  }

  getLogger(_name, _version, _options) {
    return this.#logger
  }
}

module.exports = NrLoggerProvider
