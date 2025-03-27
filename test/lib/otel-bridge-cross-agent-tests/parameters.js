/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const otel = require('@opentelemetry/api')

function currentOTelSpan() {
  const active = otel.trace.getActiveSpan()

  if (!active || active?.constructor?.name === 'NonRecordingSpan') {
    return null
  }

  return active?.spanContext()
}

function currentTransaction(agent) {
  return agent.getTransaction()
}

function currentSegment(agent) {
  const segment = agent.tracer.getSegment()
  const transaction = agent.tracer.getTransaction()
  return {
    spanId: segment?.id,
    traceId: transaction.traceId,
    sampled: transaction.sampled
  }
}

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
