/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Traceparent = require('../../w3c/traceparent')

/**
 * Accepts trace context payload if span has a parent. It will use the
 * span context to extract the traceId, traceFlags and trace state.
 *
 * @param {object} params to function
 * @param {Transaction} params.transaction active transaction
 * @param {object} params.otelSpan active span
 * @param {string} params.transport indicator of type of span(http, kafkajs, rabbitmq, etc)
 */
function propagateTraceContext({ transaction, otelSpan, transport }) {
  const spanContext = otelSpan.spanContext()
  const parentSpanId = otelSpan?.parentSpanId || otelSpan?.parentSpanContext?.spanId

  if (parentSpanId) {
    // prefix traceFlags with 0 as it is stored as a parsed int on spanContext
    const traceparent = new Traceparent({
      traceId: spanContext.traceId,
      parentId: parentSpanId,
      flags: `0${spanContext.traceFlags}`
    })
    transaction.acceptTraceContextPayload(traceparent.toString(), spanContext?.traceState?.state, transport)
  }
}

/**
 * Used to pull data an object and substitute in string.
 * @param template
 * @param data
 * @param rules
 * @example ${url.scheme}://${server.address}:${server.port}${url.path}${url.query}
 *
 */
function transformTemplate(template, data, rules = {}) {
  return template.replace(/\${(.*?)}/g, (_, key) => {
    if (key in data) {
      if (key in rules) {
        return rules[key](data[key])
      } else {
        return data[key] ?? 'unknown'
      }
    } else {
      return 'unknown'
    }
  })
}

module.exports = {
  propagateTraceContext,
  transformTemplate
}
