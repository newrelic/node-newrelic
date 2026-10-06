/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { context, diag, trace, INVALID_SPAN_CONTEXT, TraceFlags, SpanKind } = require('@opentelemetry/api')
const { NrSpan } = require('./nr-span.js')
const { toHrTime } = require('../utils/time.js')
const { makeId } = require('#agentlib/util/hashes.js')
const { SamplingDecision } = require('../constants.js')
const isTracingSuppressed = require('../utils/is-tracing-suppressed.js')

/**
 * Implements the `@opentelemetry/api` `Tracer` interface using `NrSpan` for
 * span creation. Wires the sampler and processor from the owning
 * `NrTracerProvider`.
 *
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api._opentelemetry_api.Tracer.html
 */
class NrTracer {
  #instrumentationScope
  #sampler
  #processor

  constructor({ instrumentationScope, sampler, processor }) {
    this.#instrumentationScope = instrumentationScope
    this.#sampler = sampler
    this.#processor = processor
  }

  startSpan(name, options = {}, ctx = context.active()) {
    if (options.root) {
      ctx = trace.deleteSpan(ctx)
    }

    if (isTracingSuppressed(ctx)) {
      diag.debug('Instrumentation suppressed, returning Noop Span')
      return trace.wrapSpanContext(INVALID_SPAN_CONTEXT)
    }

    let parentSpanContext = trace.getSpanContext(ctx)
    if (parentSpanContext && !trace.isSpanContextValid(parentSpanContext)) {
      parentSpanContext = undefined
    }

    const spanKind = options.kind ?? SpanKind.INTERNAL
    const traceId = parentSpanContext?.traceId ?? makeId(32)
    const spanId = makeId(16)

    const samplingResult = this.#sampler.shouldSample(
      ctx,
      traceId,
      name,
      spanKind,
      options.attributes ?? {},
      options.links ?? []
    )

    if (samplingResult.decision === SamplingDecision.NOT_RECORD) {
      return trace.wrapSpanContext({
        traceId,
        spanId,
        traceFlags: TraceFlags.NONE,
        traceState: parentSpanContext?.traceState,
        isRemote: false
      })
    }

    const spanContext = {
      traceId,
      spanId,
      traceFlags: TraceFlags.SAMPLED,
      traceState: parentSpanContext?.traceState
    }

    const span = new NrSpan({
      context: ctx,
      name,
      kind: spanKind,
      spanContext,
      parentSpanId: parentSpanContext?.spanId,
      startTime: options.startTime ? toHrTime(options.startTime) : undefined,
      attributes: options.attributes,
      links: options.links,
      instrumentationScope: this.#instrumentationScope,
      processor: this.#processor
    })

    return span
  }

  /**
   *
   * Starts a new span and calls the given function passing it the created span as first argument.
   *
   * @param {string} name The name of the span
   * @param {object|Function} [optionsOrFn] SpanOptions used for span creation
   * @param {object|Function} [contextOrFn] Context to use to extract parent
   * @param {Function} fn function called in the context of the span and receives the newly created span as an argument
   * @returns {*} return value of fn
   */
  startActiveSpan(name, optionsOrFn, contextOrFn, fn) {
    let opts = {}
    let ctx = context.active()

    if (typeof optionsOrFn === 'function') {
      fn = optionsOrFn
    } else if (typeof contextOrFn === 'function') {
      opts = optionsOrFn
      fn = contextOrFn
    } else {
      opts = optionsOrFn ?? {}
      ctx = contextOrFn ?? context.active()
      // fn is already the last argument
    }

    const span = this.startSpan(name, opts, ctx)
    const spanCtx = trace.setSpan(ctx, span)
    return context.with(spanCtx, fn, undefined, span)
  }
}

module.exports = NrTracer
