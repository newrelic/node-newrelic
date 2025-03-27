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
 * @param root0
 * @param root0.tracer
 * @param root0.spanName
 * @param root0.spanKind
 * @param cb
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

function doWorkInSegment({ agent, api, segmentName }, cb) {
  api.startSegment(segmentName, true, () => {
    const segment = agent.tracer.getSegment()
    cb(segment)
  })
}

function addOTelAttribute({ agent, name, value }, cb) {
  const segment = agent.tracer.getSegment()
  segment.addAttribute(name, value)
  cb()
}

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

function simulateExternalCall(_unused, cb) {
  const active = context.active()
  cb(active)
}

function oTelInjectHeaders({ agent, data }, cb) {
  const ctx = data
  const headers = {}
  propagation.inject(ctx, headers)
  agent.headers = headers

  return context.with(ctx, cb)
}

function nrInjectHeaders({ agent }, cb) {
  const tx = agent.tracer.getTransaction()
  const headers = {}
  tx.insertDistributedTraceHeaders(headers)
  agent.headers = headers
  cb()
}

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
