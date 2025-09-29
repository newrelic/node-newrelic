/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { SpanKind, context, propagation, trace, ROOT_CONTEXT } = require('@opentelemetry/api')

/**
 * Helper to force transaction name to make it easier for assertions
 *
 * @param {context} ctx active context
 * @param {string} name of transaction
 */
function forceTxName(ctx, name) {
  ctx.transaction.name = name
  ctx.transaction.parsedUrl = ''
}

/**
 * Helper to force segment name to make it easier for assertions
 *
 * @param {context} ctx active context
 * @param {string} name of transaction
 */
function forceSegmentName(ctx, name) {
  ctx.segment.name = name
}

/**
 * Starts an active span of a given kind.
 * If kind is server or consumer it will update the tx name
 * It will also update the segment name to the span name
 *
 * @param {object} params to function
 * @param {object} params.tracer otel tracer instance
 * @param {string} params.spanName name of span to force
 * @param {string} params.spanKind span kind to use to create span
 * @param {Function} cb function to call after span is created, passes newly created span
 */
function doWorkInSpan({ tracer, spanName, spanKind }, cb) {
  const kind = SpanKind[spanKind.toUpperCase()]
  tracer.startActiveSpan(spanName, { kind }, (span) => {
    const ctx = context.active()
    if (spanKind === 'Server' || spanKind === 'Consumer') {
      forceTxName(ctx, spanName)
    }

    if (ctx.segment) {
      forceSegmentName(ctx, spanName)
    }
    cb(span)
  })
}

/**
 * Creates a background transaction and forces the name for easier assertion.
 *
 * @param {object} params to function
 * @param {object} params.api agent api
 * @param {object} params.agent agent instance
 * @param {string} params.transactionName name of transaction to force
 * @param {Function} cb function to call within transaction and passes active tx handle
 */
function doWorkInTransaction({ api, agent, transactionName }, cb) {
  api.startBackgroundTransaction(transactionName, () => {
    const transaction = agent.tracer.getTransaction()
    const ctx = agent.tracer.getContext()
    // need to end the tx after doing a bunch of child operations
    transaction.handledExternally = true
    forceTxName(ctx, transactionName)
    cb(transaction)
  })
}

/**
 * Creates a segment and forces the name for easier assertion.
 *
 * @param {object} params to function
 * @param {object} params.api agent api
 * @param {object} params.agent agent instance
 * @param {string} params.segmentName name of segment to force
 * @param {Function} cb function to call within segment creation and passes newly created segment
 */
function doWorkInSegment({ agent, api, segmentName }, cb) {
  api.startSegment(segmentName, true, () => {
    const segment = agent.tracer.getSegment()
    cb(segment)
  })
}

/**
 * Adds attribute to active segment.
 *
 * @param {object} params to function
 * @param {object} params.agent agent instance
 * @param {string} params.name name of attribute
 * @param {string} params.value value of attribute
 * @param {Function} cb function to call after attribute has been set on segment
 */
function addOTelAttribute({ agent, name, value }, cb) {
  const segment = agent.tracer.getSegment()
  segment.addAttribute(name, value)
  cb()
}

/**
 * Adds an exception on the active span
 *
 * @param {object} params to function
 * @param {string} params.errorMessage message to set on exception
 * @param {Function} cb function to call after exception is recorded on on active span
 */
function recordExceptionOnSpan({ errorMessage }, cb) {
  const active = trace.getActiveSpan()
  const errorEvent = {
    name: 'exception',
    attributes: {
      'exception.message': errorMessage
    }
  }
  active.status.code = 2
  active.addEvent('exception', errorEvent.attributes)
  cb()
}

/**
 * Starts an active span with traceparent header.
 *
 * @param {object} params to function
 * @param {object} params.tracer otel tracer instance
 * @param {string} params.spanName name of span to force
 * @param {string} params.spanKind span kind to use to create span
 * @param {number} params.traceIdInHeader trace id to set on traceparent
 * @param {number} params.spanIdInHeader span id to set on traceparent
 * @param {number} params.sampledFlagInHeader sampled flag to set on traceparent
 * @param {Function} cb function to call after span is created, passes newly created span
 */
function doWorkInSpanWithInboundContext({ tracer, spanKind, traceIdInHeader, spanIdInHeader, sampledFlagInHeader, spanName }, cb) {
  const headers = {
    traceparent: `00-${traceIdInHeader}-${spanIdInHeader}-0${sampledFlagInHeader}`
  }
  const ctx = propagation.extract(ROOT_CONTEXT, headers)
  const kind = SpanKind[spanKind.toUpperCase()]
  tracer.startActiveSpan(spanName, { kind }, ctx, (span) => {
    if (spanKind === 'Server') {
      const ctx = context.active()
      forceTxName(ctx, spanName)
    }

    cb(span)
  })
}

/**
 * Passes the active context to callback.
 * There's nothing we need to do to simulate an external call.
 *
 * @param {object} _unused param
 * @param {Function} cb to call with active context
 */
function simulateExternalCall(_unused, cb) {
  const active = context.active()
  cb(active)
}

/**
 * Injects context and runs callback in the context
 * We put the headers on the agent to be used in assertions later.
 *
 * @param {object} params to function
 * @param {object} params.agent agent instance
 * @param {object} params.data active context
 * @param {Function} cb function to run in new context
 */
function oTelInjectHeaders({ agent, data }, cb) {
  const ctx = data
  const headers = {}
  propagation.inject(ctx, headers)
  agent.headers = headers

  context.with(ctx, cb)
}

/**
 * Inserts tracecontext into active transaction.
 * We put the headers on the agent to be used in assertions later.
 *
 * @param {object} params to function
 * @param {object} params.agent agent instance
 * @param {Function} cb function to run after setting inbound tracecontext
 */
function nrInjectHeaders({ agent }, cb) {
  const tx = agent.tracer.getTransaction()
  const headers = {}
  tx.insertDistributedTraceHeaders(headers)
  agent.headers = headers
  cb()
}

/**
 * Starts an active span with a remote context.
 *
 * @param {object} params to function
 * @param {object} params.tracer otel tracer instance
 * @param {string} params.spanName name of span to force
 * @param {string} params.spanKind span kind to use to create span
 * @param {Function} cb function to call after span is created, passes newly created span
 */
function doWorkInSpanWithRemoteParent({ tracer, spanKind, spanName }, cb) {
  const kind = SpanKind[spanKind.toUpperCase()]
  const ctx = context.active()
  const spanContext = {
    traceId: 'ba8bc8cc6d062849b0efcf3c169afb5a',
    spanId: '6d3efb1b173fecfa',
    traceFlags: '01',
    isRemote: true
  }
  trace.setSpanContext(ctx, spanContext)
  tracer.startActiveSpan(spanName, { kind }, ctx, (span) => {
    if (!ctx?.transaction && (spanKind === 'Server' || spanKind === 'Consumer')) {
      const newCtx = context.active()
      forceTxName(newCtx, spanName)
    }
    cb(span)
  })
}

module.exports = {
  addOTelAttribute,
  doWorkInSegment,
  doWorkInSpan,
  doWorkInSpanWithInboundContext,
  doWorkInSpanWithRemoteParent,
  doWorkInTransaction,
  nrInjectHeaders,
  recordExceptionOnSpan,
  simulateExternalCall,
  oTelInjectHeaders
}
