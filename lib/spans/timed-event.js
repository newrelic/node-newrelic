/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { Attributes } = require('#agentlib/attributes.js')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const normalizeTimestamp = require('#agentlib/otel/normalize-timestamp.js')

class TimedEvent {
  constructor({ event, spanContext }) {
    this.userAttributes = new Attributes({ scope: Attributes.SCOPE_SEGMENT })
    this.agentAttributes = new Attributes({ scope: Attributes.SCOPE_SEGMENT })
    this.intrinsics = Object.create(null)

    const timestamp = normalizeTimestamp(event.time)

    this.intrinsics.type = 'SpanEvent'
    this.intrinsics.timestamp = timestamp > 0 ? timestamp : Date
    this.intrinsics['span.id'] = spanContext.spanId
    this.intrinsics['trace.id'] = spanContext.traceId
    this.intrinsics.name = event.name

    for (const [key, value] of Object.entries(event.attributes)) {
      this.agentAttributes.addAttribute(DESTINATIONS.TRANS_SEGMENT, key, value)
    }
  }

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
