/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NrTracer = require('./nr-tracer.js')

/**
 * Implements the `@opentelemetry/api` `TracerProvider` interface without
 * depending on `@opentelemetry/sdk-trace-base`. Wires `NrSampler` and
 * `NrSpanProcessor` into the one tracer the agent manages for hybrid agent.
 *
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api._opentelemetry_api.TracerProvider.html
 */
class NrTracerProvider {
  #sampler
  #processor

  constructor({ sampler, processor }) {
    this.#sampler = sampler
    this.#processor = processor
  }

  getTracer(name, version) {
    return new NrTracer({
      instrumentationScope: { name, version },
      sampler: this.#sampler,
      processor: this.#processor
    })
  }

  forceFlush() {
    return Promise.resolve()
  }

  shutdown() {
    return Promise.resolve()
  }
}

module.exports = NrTracerProvider
