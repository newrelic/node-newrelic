/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const invalidTraceId = '0'.repeat(32)
const invalidParentId = '0'.repeat(16)

/**
 * Parses a W3C traceparent header into an object representation.
 *
 * @see {@link https://www.w3.org/TR/trace-context/#traceparent-header}
 *
 * @property {string} version Traceparent spec version parsed from the header.
 * @property {string} traceId Trace identifier from the header.
 * @property {string} parentId Span identifier from the header.
 * @property {string} flags Flags as parsed from the header.
 */
class Traceparent {
  static W3C_TRACEPARENT_VERSION = '00'
  static FLAG_SAMPLED = 0x00000001

  #flagBits = 0x00000000

  constructor({ version = Traceparent.W3C_TRACEPARENT_VERSION, traceId, parentId, flags }) {
    if (version !== Traceparent.W3C_TRACEPARENT_VERSION || version.toLowerCase() === 'ff') {
      throw Error(`only w3c version ${Traceparent.W3C_TRACEPARENT_VERSION} is supported, found ${version}`)
    }
    if (this.#isValidTraceId(traceId) === false) {
      throw Error(`received invalid trace id: ${traceId}`)
    }
    if (this.#isValidParentId(parentId) === false) {
      throw Error(`received invalid parent id: ${parentId}`)
    }
    if (this.#isValidFlags(flags) === false) {
      throw Error(`received invalid flags: ${flags}`)
    }

    Object.defineProperties(this, {
      version: {
        enumerable: true,
        value: version
      },
      traceId: {
        enumerable: true,
        value: traceId
      },
      parentId: {
        enumerable: true,
        value: parentId
      },
      flags: {
        enumerable: true,
        value: flags
      }
    })

    this.#flagBits = parseInt(flags, 16)
  }

  get [Symbol.toStringTag]() {
    return 'Traceparent'
  }

  /**
   * Constructs a new instance from a header value.
   *
   * @param {string} header The traceparent header value to parse.
   *
   * @throws {Error} if any part of the header is invalid
   */
  static fromHeader(header) {
    if (typeof header !== 'string') {
      throw Error('header value must be a string')
    }

    const parts = header.trim().split('-')
    if (parts.length !== 4) {
      throw Error(`traceparent header should have 4 parts, found ${parts.length}`)
    }

    const [version, traceId, parentId, flags] = parts
    return new Traceparent({ version, traceId, parentId, flags })
  }

  /**
   * Construct a new instance from an OTEL span context.
   *
   * @see {@link https://opentelemetry.io/docs/concepts/signals/traces/#span-context}
   *
   * @param {object} spanContext OTEL span context
   *
   * @returns {Traceparent}
   */
  static fromSpanContext(spanContext) {
    return new Traceparent({
      traceId: spanContext.traceId,
      parentId: spanContext.spanId,
      // Our span context implementation does not implement the flags as a bit
      // field. So we will just concatenate. See the span implementation in
      // the OTEL bridge code.
      flags: `0${Number(spanContext.traceFlags || 0)}`
    })
  }

  /**
   * Whether or not the header indicated the trace was sampled by the sending
   * system.
   *
   * @returns {boolean}
   */
  get isSampled() {
    return (this.#flagBits & Traceparent.FLAG_SAMPLED) === 1
  }

  toString() {
    return `${this.version}-${this.traceId}-${this.parentId}-${this.flags}`
  }

  #isValidFlags(flags) {
    return /^[a-f0-9]{2}$/.test(flags)
  }

  #isValidParentId(id) {
    if (id === invalidParentId) {
      return false
    }

    return /^[a-f0-9]{16}$/.test(id)
  }

  #isValidTraceId(id) {
    if (id === invalidTraceId) {
      return false
    }

    return /^[a-f0-9]{32}$/.test(id)
  }

  // begin: accessors for cross agent tests
  get trace_flags() {
    return this.flags
  }

  get parent_id() {
    return this.parentId
  }

  get trace_id() {
    return this.traceId
  }
  // end: accessors for cross agent tests
}

module.exports = Traceparent
