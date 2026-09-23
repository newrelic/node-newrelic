/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { diag, SpanStatusCode } = require('@opentelemetry/api')
const { hrTime, toHrTime, hrTimeDiff, isTimeInput } = require('../utils/time.js')
const { ATTR_VALUE_LENGTH_LIMIT } = require('../constants.js')
const {
  EXCEPTION_MESSAGE,
  EXCEPTION_STACKTRACE,
  EXCEPTION_TYPE
} = require('./constants.js')

function isValidPrimitiveType(type) {
  return type === 'string' || type === 'number' || type === 'boolean'
}

/**
 * Checks whether a value is a valid OTEL attribute value: a primitive
 * (string/number/boolean), a homogeneous array of one of those primitives,
 * or null/undefined.
 *
 * @param {string|number|boolean|Array|null|undefined} value the value to check
 * @returns {boolean} true if the value is a valid attribute value
 */
function isAttributeValue(value) {
  if (value == null) return true
  if (Array.isArray(value)) {
    let type
    for (const el of value) {
      if (el == null) continue
      const elType = typeof el
      if (elType === type) continue
      if (!type && isValidPrimitiveType(elType)) {
        type = elType
        continue
      }
      return false
    }
    return true
  }
  return isValidPrimitiveType(typeof value)
}

function truncate(value) {
  if (typeof value === 'string' && value.length > ATTR_VALUE_LENGTH_LIMIT) {
    return value.substring(0, ATTR_VALUE_LENGTH_LIMIT)
  }
  return value
}

function truncateLink(link) {
  if (!link.attributes) return link
  const attributes = {}
  for (const [k, v] of Object.entries(link.attributes)) {
    attributes[k] = truncate(v)
  }
  return { ...link, attributes }
}

/**
 * Our own span implementation. It satisfies
 * the `@opentelemetry/api` `Span` interface (for user-facing code) and also
 * exposes all readable properties that `NrSpanProcessor` needs.
 *
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api._opentelemetry_api.Span.html
 */
class NrSpan {
  name
  kind
  attributes = {}
  events = []
  links = []
  status = { code: 0 }
  instrumentationScope
  startTime
  #duration = [0, 0]
  parentSpanId

  #spanContext
  #processor
  #ended = false

  constructor({
    context,
    name,
    kind,
    spanContext,
    parentSpanId,
    startTime,
    attributes,
    links,
    instrumentationScope,
    processor
  }) {
    this.name = name
    this.kind = kind
    this.#spanContext = spanContext
    this.parentSpanId = parentSpanId
    this.startTime = startTime ?? hrTime()
    this.instrumentationScope = instrumentationScope ?? { name: '', version: undefined }
    this.#processor = processor

    if (attributes) {
      for (const [k, v] of Object.entries(attributes)) {
        this.attributes[k] = truncate(v)
      }
    }
    if (links) {
      this.links = links.map(truncateLink)
    }

    this.#processor.onStart(this, context)
  }

  spanContext() {
    return this.#spanContext
  }

  setAttribute(key, value) {
    if (value == null || this.#isSpanEnded()) return this
    if (key.length === 0) {
      diag.warn(`Invalid attribute key: ${key}`)
      return this
    }
    if (!isAttributeValue(value)) {
      diag.warn(`Invalid attribute value set for key: ${key}`)
      return this
    }

    this.attributes[key] = truncate(value)
    return this
  }

  setAttributes(attributes) {
    for (const [k, v] of Object.entries(attributes)) {
      this.setAttribute(k, v)
    }
    return this
  }

  addEvent(name, attributesOrStartTime, timeStamp) {
    if (this.#isSpanEnded()) return this

    const attributes = {}
    let time = hrTime()

    if (attributesOrStartTime != null) {
      if (isTimeInput(attributesOrStartTime)) {
        time = toHrTime(attributesOrStartTime)
      } else {
        for (const [k, v] of Object.entries(attributesOrStartTime)) {
          attributes[k] = truncate(v)
        }
        if (timeStamp != null) time = toHrTime(timeStamp)
      }
    }

    this.events.push({ name, attributes, time })
    return this
  }

  addLink(link) {
    if (this.#isSpanEnded()) return this
    this.links.push(truncateLink(link))
    return this
  }

  addLinks(links) {
    for (const link of links) {
      this.addLink(link)
    }
    return this
  }

  setStatus({ code, message } = {}) {
    if (this.#isSpanEnded()) return this
    if (code === undefined || code === SpanStatusCode.UNSET) return this
    if (this.status.code === SpanStatusCode.OK) return this

    const newStatus = { code }
    if (code === SpanStatusCode.ERROR) {
      if (typeof message === 'string') {
        newStatus.message = message
      } else if (message != null) {
        diag.warn(`Dropping invalid status.message of type '${typeof message}', expected 'string'`)
      }
    }

    this.status = newStatus
    return this
  }

  updateName(name) {
    if (this.#isSpanEnded()) return this
    this.name = name
    return this
  }

  end(endTime) {
    if (this.#ended) return
    this.#ended = true
    const end = toHrTime(endTime)
    this.#duration = hrTimeDiff(this.startTime, end)
    if (this.#duration[0] < 0) {
      diag.warn('Inconsistent start and end time, startTime > endTime. Setting span duration to 0ms.', this.startTime, end)
      this.#duration = [0, 0]
    }
    this.#processor?.onEnd(this)
  }

  isRecording() {
    return this.#ended === false
  }

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
      if (exception.message) attributes[EXCEPTION_MESSAGE] = exception.message
      if (exception.stack) attributes[EXCEPTION_STACKTRACE] = exception.stack
    }
    if (attributes[EXCEPTION_TYPE] || attributes[EXCEPTION_MESSAGE]) {
      this.addEvent('exception', attributes, time)
    }
  }

  get ended() {
    return this.#ended
  }

  get duration() {
    return this.#duration
  }

  #isSpanEnded() {
    if (this.#ended) {
      diag.warn(`Cannot execute the operation on ended Span {traceId: ${this.#spanContext.traceId}, spanId: ${this.#spanContext.spanId}}`)
    }
    return this.#ended
  }
}

module.exports = { NrSpan }
