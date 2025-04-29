/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const otel = require('@opentelemetry/api')

/**
 * Gets the current active span context.
 * Only returns if span is not `NonRecordingSpan`(meaning it was not sampled)
 * @returns {object|null} active span context
 */
function currentOTelSpan() {
  const active = otel.trace.getActiveSpan()

  if (!active || active?.constructor?.name === 'NonRecordingSpan') {
    return null
  }

  return active?.spanContext()
}

/**
 * Returns the current transaction from context.
 * @param {object} agent instance
 * @returns {object|null} active transaction
 */
function currentTransaction(agent) {
  return agent.getTransaction()
}

/**
 *
 * Returns the span context from active segment.
 *
 * @param {object} agent instance
 * @returns {object} active span context from segment
 */
function currentSegment(agent) {
  const segment = agent.tracer.getSegment()
  const transaction = agent.tracer.getTransaction()
  return {
    spanId: segment?.id,
    traceId: transaction.traceId,
    sampled: transaction.sampled
  }
}

/**
 * Returns span context from injected traceparent header
 *
 * @param {object} agent instance
 * @returns {object} span context from injected traceparent header
 */
function injected(agent) {
  const { headers } = agent
  const { traceparent } = headers
  const fields = traceparent.split('-')
  return {
    traceId: fields[1],
    spanId: fields[2],
    sampled: fields[3] === '01'
  }
}

module.exports = {
  currentOTelSpan,
  currentSegment,
  currentTransaction,
  injected
}
