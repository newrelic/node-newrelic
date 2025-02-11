/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { trace, isSpanContextValid, TraceFlags } = require('@opentelemetry/api')
const { isTracingSuppressed } = require('@opentelemetry/core')
const TRACE_PARENT_HEADER = 'traceparent'
const TRACE_STATE_HEADER = 'tracestate'

const VERSION = '00'
const VERSION_PART = '(?!ff)[\\da-f]{2}'
const TRACE_ID_PART = '(?![0]{32})[\\da-f]{32}'
const PARENT_ID_PART = '(?![0]{16})[\\da-f]{16}'
const FLAGS_PART = '[\\da-f]{2}'
const TRACE_PARENT_REGEX = new RegExp(
  `^\\s?(${VERSION_PART})-(${TRACE_ID_PART})-(${PARENT_ID_PART})-(${FLAGS_PART})(-.*)?\\s?$`
)

// TODO: handle trace state
class TraceState {
  constructor(state) {
    this.state = state
  }
}

/**
 * Parses information from the [traceparent] span tag and converts it into {@link SpanContext}
 * @param traceParent - A meta property that comes from server.
 *     It should be dynamically generated server side to have the server's request trace Id,
 *     a parent span Id that was set on the server's request span,
 *     and the trace flags to indicate the server's sampling decision
 *     (01 = sampled, 00 = not sampled).
 *     for example: '{version}-{traceId}-{spanId}-{sampleDecision}'
 *     For more information see {@link https://www.w3.org/TR/trace-context/}
 * @param traceParen
 */
function parseTraceParent(traceParent) {
  const match = TRACE_PARENT_REGEX.exec(traceParent)
  if (!match) return null

  // According to the specification the implementation should be compatible
  // with future versions. If there are more parts, we only reject it if it's using version 00
  // See https://www.w3.org/TR/trace-context/#versioning-of-traceparent
  if (match[1] === '00' && match[5]) return null

  return {
    traceId: match[2],
    spanId: match[3],
    traceFlags: parseInt(match[4], 16),
  }
}

module.exports = class NewRelicTracePropagator {
  constructor(agent) {
    this.agent = agent
  }

  inject(context, carrier, setter) {
    if (context.constructor.name === 'BaseContext') {
      context = this.agent.tracer._contextManager.getContext()
    }
    const spanContext = trace.getSpanContext(context)
    if (
      !spanContext ||
      isTracingSuppressed(context) ||
      !isSpanContextValid(spanContext)
    ) { return }

    const traceParent = `${VERSION}-${spanContext.traceId}-${
      spanContext.spanId
    }-0${Number(spanContext.traceFlags || TraceFlags.NONE).toString(16)}`

    setter.set(carrier, TRACE_PARENT_HEADER, traceParent)
    if (spanContext.traceState) {
      setter.set(
        carrier,
        TRACE_STATE_HEADER,
        spanContext.traceState.serialize()
      )
    }
  }

  extract(context, carrier, getter) {
    if (context.constructor.name === 'BaseContext') {
      context = this.agent.tracer._contextManager.getContext()
    }
    const traceParentHeader = getter.get(carrier, TRACE_PARENT_HEADER)
    if (!traceParentHeader) return context
    const traceParent = Array.isArray(traceParentHeader)
      ? traceParentHeader[0]
      : traceParentHeader
    if (typeof traceParent !== 'string') return context
    const spanContext = parseTraceParent(traceParent)
    if (!spanContext) return context

    spanContext.isRemote = true

    const traceStateHeader = getter.get(carrier, TRACE_STATE_HEADER)
    if (traceStateHeader) {
      // If more than one `tracestate` header is found, we merge them into a
      // single header.
      const state = Array.isArray(traceStateHeader)
        ? traceStateHeader.join(',')
        : traceStateHeader
      spanContext.traceState = new TraceState(
        typeof state === 'string' ? state : undefined
      )
    }
    return trace.setSpanContext(context, spanContext)
  }

  fields() {
    return [TRACE_PARENT_HEADER, TRACE_STATE_HEADER]
  }
}
