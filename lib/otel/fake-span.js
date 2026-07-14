/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * In order to be able to return the appropriate span context
 * within otel bridge. We have to create fake spans for new relic
 * segments.  The only thing needed is a method for `spanContext`
 * which should return the spanId(segment id) and traceId(transaction trace id).
 * We hard code traceFlags to 1.
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

  addEvent(name, _attrsOrTime, _time) {
    this.#segment.logger.warn(
      'addEvent is not implemented. Not adding event: %s.',
      name
    )
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

  recordException(exception, time) {
    // This replicates what the original actually does.
    // See:
    // https://github.com/open-telemetry/opentelemetry-js/blob/9b05f66/packages/sdk-trace/src/Span.ts#L427-L451.
    this.addEvent(exception, null, time)
  }
}
