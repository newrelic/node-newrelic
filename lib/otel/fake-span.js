/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const isTimeInput = require('./is-time-input.js')
const TimedEvent = require('../spans/timed-event.js')
const {
  EXCEPTION_MESSAGE,
  EXCEPTION_STACKTRACE,
  EXCEPTION_TYPE
} = require('./traces/constants.js')

/**
 * In order to be able to return the appropriate span context
 * within otel bridge. We have to create fake spans for new relic
 * segments.  The only thing needed is a method for `spanContext`
 * which should return the spanId(segment id) and traceId(transaction trace id).
 * We hard code traceFlags to 1.
 *
 * Note: as of 2026-07 we stub methods on this object that do not make sense
 * in the context of our bridge. For example, we internally manage the name
 * and lifecyle of spans. So those methods are no-ops here.
 *
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api._opentelemetry_api.Span.html
 */
module.exports = class FakeSpan {
  #segment
  #transaction

  constructor(segment, transaction) {
    this.#segment = segment
    this.#transaction = transaction
  }

  get segmentId() {
    return this.#segment.id
  }

  get traceId() {
    return this.#transaction.traceId
  }

  spanContext() {
    return {
      spanId: this.segmentId,
      traceId: this.traceId,
      traceFlags: 1
    }
  }

  /**
   * Adds a new attribute to the backing segment.
   *
   * @param {string} key The attribute name to add
   * @param {*} value Some serializable JavaScript value.
   *
   * @returns {FakeSpan}
   */
  setAttribute(key, value) {
    this.#segment.addAttribute(key, value)
    return this
  }

  /**
   * Add multiple attributes to the backing segment at once.
   *
   * @param {object} attributes Each field name is the key, and each field
   * value the value passed to {@link #setAttribute}.
   *
   * @returns {FakeSpan}
   */
  setAttributes(attributes) {
    for (const [k, v] of Object.entries(attributes)) {
      this.setAttribute(k, v)
    }
    return this
  }

  /**
   * Adds a new timed event to the backing segment.
   *
   * This replicates what the original actually does.
   * See:
   * https://github.com/open-telemetry/opentelemetry-js/blob/9b05f668ee7ab884a44b04b504e0baaff6c6d2b2/packages/sdk-trace/src/Span.ts#L201-L263
   *
   * @param {string} name The name of the event.
   * @param {object|number[]|number|Date} [attributesOrStartTime] Either the
   * attributes to associate with the event, or the start time of the event
   * when no attributes are being provided.
   * @param {number[]|number|Date} [timeStamp] The start time of the event.
   *
   * @returns {FakeSpan}
   */
  addEvent(name, attributesOrStartTime, timeStamp) {
    if (isTimeInput(attributesOrStartTime)) {
      if (!isTimeInput(timeStamp)) {
        timeStamp = attributesOrStartTime
      }
      attributesOrStartTime = undefined
    }

    const timedEvent = new TimedEvent({
      event: {
        name,
        attributes: attributesOrStartTime ?? {},
        time: timeStamp
      },
      spanContext: this.spanContext()
    })
    this.#segment.addTimedEvent(timedEvent)

    return this
  }

  /**
   * Adds a new span link to the backing segment.
   *
   * @param {object} link An OTEL shaped span link.
   *
   * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api._opentelemetry_api.Link.html
   *
   * @returns {FakeSpan}
   */
  addLink(link) {
    this.#segment.addSpanLink(link)
    return this
  }

  /**
   * Adds multiple span links to the backing segment at once.
   *
   * @param {object[]} links A list of OTEL shaped span links.
   *
   * @see @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api._opentelemetry_api.Link.html
   *
   * @returns {FakeSpan}
   */
  addLinks(links) {
    for (const link of links) {
      this.addLink(link)
    }
    return this
  }

  setStatus(otelSpanStatus) {
    this.#segment.logger.warn(
      'setStatus is not implemented. Not setting status: %s.',
      otelSpanStatus?.code
    )
    return this
  }

  updateName(name) {
    this.#segment.logger.warn(
      'updateName is not implemented. Not setting name: %s.',
      name
    )
    return this
  }

  end(_time) {
    this.#segment.logger.warn(
      'end is not implemented. Not ending span.'
    )
  }

  isRecording() {
    return true
  }

  /**
   * Records an exception as a timed event on the backing segment.
   *
   * This replicates what the original actually does.
   * See:
   * https://github.com/open-telemetry/opentelemetry-js/blob/9b05f66/packages/sdk-trace/src/Span.ts#L427-L451.
   *
   * @param {string|Error} exception The exception to record.
   * @param {number[]|number|Date} [time] The time the exception occurred.
   */
  recordException(exception, time) {
    const attributes = {}

    if (typeof exception === 'string') {
      attributes[EXCEPTION_MESSAGE] = exception
    } else if (exception) {
      if (exception.code) {
        attributes[EXCEPTION_TYPE] = exception.code.toString()
      } else if (exception.name) {
        attributes[EXCEPTION_TYPE] = exception.name
      }
      if (exception.message) {
        attributes[EXCEPTION_MESSAGE] = exception.message
      }
      if (exception.stack) {
        attributes[EXCEPTION_STACKTRACE] = exception.stack
      }
    }

    if (attributes[EXCEPTION_TYPE] || attributes[EXCEPTION_MESSAGE]) {
      this.addEvent('exception', attributes, time)
    } else {
      this.#segment.logger.warn('Failed to record exception: %s.', exception)
    }
  }
}
