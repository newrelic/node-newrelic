/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const api = require('@opentelemetry/api')

/**
 * @see https://opentelemetry.io/docs/specs/otel/trace/api/#tracer
 * @see https://open-telemetry.github.io/opentelemetry-js/classes/_opentelemetry_sdk_trace_base.Tracer.html
 */
class Tracer {
  #config
  #instrumentationLibrary
  #tracerProvider

  constructor(instrumentationLibrary, config, tracerProvider) {
    this.#config = config
    this.#instrumentationLibrary = instrumentationLibrary
    this.#tracerProvider = tracerProvider
  }

  get instrumentationLibrary() {
    return this.#instrumentationLibrary
  }

  startSpan(name, options, context) {
    // synthesize
    // have ot update signature to pass in name separate from options
  }

  startActiveSpan(name, options, context, fn) {
  }
}

module.exports = Tracer
