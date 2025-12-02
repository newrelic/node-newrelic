/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { Attributes } = require('#agentlib/attributes.js')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const defaultLogger = require('#agentlib/logger.js').child({ component: 'span-link' })

/**
 * SpanLink represents the metadata attached by instrumentation when storing
 * messages for later retrieval. This metadata allows linking the retrieved
 * entities to the transaction(s) that generated the original message in a
 * distributed system. Span links are most likely to be encountered in
 * "consumer" scenarios for system like SQS, MQTT, or Kafka.
 *
 * @private
 * @class
 *
 * @property {Attributes} userAttributes User attributes that were added to
 * the message before it was stored.
 * @property {Attributes} agentAttributes Agent attributes that the New Relic
 * agent has determined need to be present.
 * @property {object} intrinsics The core attributes that must be present
 * for the backend system to recognize this data as a span link.
 */
class SpanLink {
  /**
   * Creates a new span link instance.
   *
   * @param {object} params Data required for creating the object.
   * @param {object} params.link The object that contains the original span
   * link metadata. As of 2025-11-25, this would be an object from the `links`
   * array on an Open Telemetry span that has been intercepted through our
   * OTEL bridge. In other words, it is an instance of OTEL's `Link` interface.
   * See https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_sdk-node._opentelemetry_api.Link.html.
   * @param {object} params.spanContext The context associated with the span
   * that contained the original link data.
   * @param {number} [params.timestamp] The number of milliseconds since the
   * epoch representing when the link was originally recorded.
   * @param {object} [deps] Optional injected dependencies.
   * @param {object} [deps.logger] Agent logger instance.
   * @throws {Error} When missing link or span context data.
   */
  constructor({ link, spanContext, timestamp = 0 } = {}, { logger = defaultLogger } = {}) {
    this.userAttributes = new Attributes({ scope: Attributes.SCOPE_SEGMENT })
    this.agentAttributes = new Attributes({ scope: Attributes.SCOPE_SEGMENT })
    this.intrinsics = Object.create(null)

    if (!link) {
      logger.error('cannot create span link without required link data')
      return
    }

    if (!spanContext) {
      logger.error('cannot create span link without required span context')
      return
    }

    this.intrinsics.type = 'SpanLink'
    this.intrinsics.id = spanContext.spanId
    this.intrinsics.timestamp = timestamp > 0 ? timestamp : Date.now()
    this.intrinsics['trace.id'] = spanContext.traceId
    this.intrinsics.linkedSpanId = link.context.spanId
    this.intrinsics.linkedTraceId = link.context.traceId

    for (const [key, value] of Object.entries(link.attributes)) {
      this.userAttributes.addAttribute(DESTINATIONS.TRANS_SEGMENT, key, value)
    }
  }

  get [Symbol.toStringTag]() {
    return 'SpanLink'
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

module.exports = SpanLink
