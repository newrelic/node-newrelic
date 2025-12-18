/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { Attributes } = require('#agentlib/attributes.js')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const normalizeTimestamp = require('#agentlib/otel/normalize-timestamp.js')

/**
 * TimedEvent (OTEL Span Event) represent metadata on a Span (structured like
 * a log message or annotation) and it's typically used to denote a meaningful,
 * singular point in time within the span's duration.
 *
 * @private
 * @class
 *
 * @property {Attributes} userAttributes User attributes that were added to
 * the event before it was stored.
 * @property {Attributes} agentAttributes Agent attributes that the New Relic
 * agent has determined need to be present.
 * @property {object} intrinsics The core attributes that must be present
 * for the backend system to recognize this data as a span event.
 */
class TimedEvent {
  /**
   * Creates a new span event instance.
   *
   * @param {object} params Data required for creating the object.
   * @param {object} params.event The OpenTelemetry span event object.
   * See https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_sdk-node.node.TimedEvent.html
   * @param {object} params.spanContext The OpenTelemetry span context object.
   */
  constructor({ event, spanContext }) {
    this.userAttributes = new Attributes({ scope: Attributes.SCOPE_SEGMENT })
    this.agentAttributes = new Attributes({ scope: Attributes.SCOPE_SEGMENT })
    this.intrinsics = Object.create(null)

    const timestamp = normalizeTimestamp(event.time)

    this.intrinsics.type = 'SpanEvent'
    this.intrinsics.timestamp = timestamp
    this.intrinsics['span.id'] = spanContext.spanId
    this.intrinsics['trace.id'] = spanContext.traceId
    this.intrinsics.name = event.name

    for (const [key, value] of Object.entries(event.attributes)) {
      this.agentAttributes.addAttribute(DESTINATIONS.TRANS_SEGMENT, key, value)
    }
  }

  get [Symbol.toStringTag]() { return 'TimedEvent' }

  getIntrinsicAttributes() {
    return this.intrinsics
  }

  toJSON() {
    return [
      filterNulls(this.intrinsics),
      filterNulls(this.userAttributes.get(DESTINATIONS.TRANS_SEGMENT)),
      filterNulls(this.agentAttributes.get(DESTINATIONS.TRANS_SEGMENT))
    ]
  }
}

function filterNulls(inputObj) {
  return Object.fromEntries(
    Object
      .entries(inputObj)
      .filter(([, value]) => value != null)
  )
}

module.exports = TimedEvent
