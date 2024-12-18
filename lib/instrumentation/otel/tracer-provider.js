/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  context: otelContextApi,
  propagation: otelPropagatorApi,
  trace: otelTraceApi
} = require('@opentelemetry/api')
const { W3CTraceContextPropagator } = require('@opentelemetry/core')

const ContextManager = require('./context-manager')
const Tracer = require('./tracer')

/**
 * @see https://opentelemetry.io/docs/specs/otel/trace/api/#tracerprovider
 * @see https://open-telemetry.github.io/opentelemetry-js/classes/_opentelemetry_sdk_trace_node.NodeTracerProvider.html
 */
class NRTracerProvider {
  #config
  #resource

  #tracers
  #contextManager

  /**
   *
   * @param {object} config https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_sdk_trace_base.TracerConfig.html
   */
  constructor(agent, config = {}) {
    this.#config = config
    this.#resource = config.resource
    this.#tracers = new Map()
    this.#contextManager = new ContextManager(agent)
  }

  /**
   * Retrieve a tracer, or return a new one if none found.
   *
   * @param {string} name Tracer scope name.
   * @param {string} [version] A semver style version string representing the
   * version of the scoped entity being traced.
   * @param {object} [options] Additional options.
   * @param {string} [options.schemaUrl] Schema URL to be emitted in telemetry.
   *
   * @returns {Tracer} The found, or created, tracer.
   *
   * @see https://opentelemetry.io/docs/specs/otel/trace/api/#get-a-tracer
   * @see https://open-telemetry.github.io/opentelemetry-js/classes/_opentelemetry_sdk_trace_base.BasicTracerProvider.html#getTracer
   */
  getTracer(name, version = '0.0.0', options = {}) {
    const { schemaUrl } = options
    // Key as constructed upstream: https://github.com/open-telemetry/opentelemetry-js/blob/2a4919c1cf99d3403d387d7589836fd9e3018896/packages/opentelemetry-sdk-trace-base/src/BasicTracerProvider.ts#L102
    const key = `${name}@${version}:${schemaUrl || ''}`
    if (this.#tracers.has(key) === false) {
      // The spec says we _must_ return a fallback tracer rather than
      // returning `null` or throwing an error when the provided name is empty.
      const tracer = new Tracer({ name, version, schemaUrl }, this.#config, this)
      this.#tracers.set(key, tracer)
      return tracer
    }
    return this.#tracers.get(key)
  }

  /**
   * The constructor sets up some basic class fields. This, as highlighted in
   * the documenation, is meant to be invoked subsequent to class instantiation
   * as a means to establish more specific configuration.
   *
   * @param {object} [config]
   *
   * @see https://github.com/open-telemetry/opentelemetry-js/blob/9de31518e76a38050f1a5676124fffd259085263/packages/opentelemetry-sdk-trace-node/README.md
   */
  register(config = {}) {
    otelContextApi.setGlobalContextManager(this.#contextManager)
    if (otelTraceApi.setGlobalTracerProvider(this) === false) {
      // https://open-telemetry.github.io/opentelemetry-js/classes/_opentelemetry_api.TraceAPI.html#setGlobalTracerProvider
      // The default tracer provider defined by the API is a
      // `ProxyTracerProvider` instance. That class provides a unique method,
      // `setDelegate`, that we can use instead.
      otelTraceApi.getTracerProvider().setDelegate(this)
    }

    if (config.propagator) {
      otelPropagatorApi.setGlobalPropagator(config.propagator)
    } else {
      otelPropagatorApi.setGlobalPropagator(new W3CTraceContextPropagator())
    }
  }
}

module.exports = NRTracerProvider
