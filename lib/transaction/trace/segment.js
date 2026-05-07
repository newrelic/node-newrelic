/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('../../logger').child({ component: 'trace-segment' })
const { DESTINATIONS } = require('../../config/attribute-filter')
const Timer = require('../../timer')
const hashes = require('../../util/hashes')

const { Attributes } = require('../../attributes')
const SpanContext = require('../../spans/span-context')

const NAMES = require('../../metrics/names')
const STATE = {
  EXTERNAL: 'EXTERNAL',
  CALLBACK: 'CALLBACK'
}
const ATTRIBUTE_SCOPE = Attributes.SCOPE_SEGMENT

/**
 * Initializes the segment and binds the recorder to itself, if provided.
 *
 * @class
 * @classdesc
 * TraceSegments are inserted to track instrumented function calls. They
 * are reported as part of a transaction trace. It has name (used only internally to the framework
 * for now), and has one or more children (that are also part of the same
 * transaction trace), as well as an associated timer.
 * @param {object} params to function
 * @param {number} params.id id if passed in used as segment id. only used in otel bridge mode to ensure span id is same as segment
 * @param {object} params.config agent config
 * @param {string} params.name Human-readable name for this segment (e.g. 'http', 'net', 'express',
 *  'mysql', etc).
 *  @param {number} params.parentId parent id of segment
 * @param {boolean} params.collect flag to collect as part of transaction trace
 * @param {object} [deps] Optional dependencies.
 * @param {object} [deps.logger] An agent logger instance.
 */
function TraceSegment(
  { id, config, name, collect, parentId },
  { logger = defaultLogger } = {}
) {
  this.logger = logger
  this.name = name
  this.attributes = new Attributes({
    scope: ATTRIBUTE_SCOPE,
    valueLengthLimit: config?.attributes.value_size_limit
  })
  this.spanLinks = []
  this.timedEvents = []
  this.spansEnabled = config?.distributed_tracing?.enabled && config?.span_events?.enabled

  // Generate a unique id for use in span events.
  this.id = id || hashes.makeId()
  this.parentId = parentId
  this.timer = new Timer()

  this.internal = false
  this.opaque = false
  this.shimId = null

  // hidden class optimization
  this.partialName = null
  this._exclusiveDuration = null
  this._collect = collect
  this.host = null
  this.port = null
  this.state = STATE.EXTERNAL
  this.async = true
  this.ignore = false
  // only use to specify spanKind on segments created with `api.startBackgroundTransaction` and `api.startWebTransaction`
  // we typically determine the span kind based on the segment name
  this.spanKind = null
}

TraceSegment.prototype.getSpanContext = function getSpanContext() {
  if (!this._spanContext && this.spansEnabled) {
    this._spanContext = new SpanContext()
  }

  return this._spanContext
}

TraceSegment.prototype.addAttribute = function addAttribute(key, value, truncateExempt = false) {
  this.attributes.addAttribute(DESTINATIONS.SEGMENT_SCOPE, key, value, truncateExempt)
}

TraceSegment.prototype.addSpanAttribute = function addSpanAttribute(
  key,
  value,
  truncateExempt = false
) {
  this.attributes.addAttribute(DESTINATIONS.SPAN_EVENT, key, value, truncateExempt)
}

TraceSegment.prototype.addSpanAttributes = function addSpanAttributes(attributes) {
  this.attributes.addAttributes(DESTINATIONS.SPAN_EVENT, attributes)
}

TraceSegment.prototype.getAttributes = function getAttributes() {
  return this.attributes.get(DESTINATIONS.TRANS_SEGMENT)
}

TraceSegment.prototype.getSpanId = function getSpanId() {
  if (this.spansEnabled) {
    return this.id
  }

  return null
}

/**
 * For use when a transaction is ending.  The transaction segment should
 * be named after the transaction it belongs to (which is only known by
 * the end).
 * @param {Transaction} transaction The transaction to which this segment will be bound.
 */
TraceSegment.prototype.setNameFromTransaction = function setNameFromTransaction(transaction) {
  // transaction name and transaction segment name must match
  this.name = transaction.getFullName()

  // partialName is used to name apdex metrics when recording
  this.partialName = transaction._partialName
}

/**
 * Once a transaction is named, the web segment also needs to be updated to
 * match it (which implies this method must be called subsequent to
 * transaction.finalizeNameFromWeb). To properly name apdex metrics during metric
 * recording, it's also necessary to copy the transaction's partial name. And
 * finally, marking the trace segment as being a web segment copies the
 * segment's parameters onto the transaction.
 * @param {Transaction} transaction The transaction to which this segment will be bound.
 * @param {object} obfuscatedUrl The obfuscated URL for the request.
 */
TraceSegment.prototype.markAsWeb = function markAsWeb(transaction, obfuscatedUrl) {
  this.setNameFromTransaction(transaction)

  const traceAttrs = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
  for (const key of Object.keys(traceAttrs)) {
    if (!this.attributes.has(key)) {
      this.addAttribute(key, traceAttrs[key])
    }
  }

  this.addSpanAttribute('request.uri', obfuscatedUrl)
}

/**
 * A segment attached to something evented (such as a database
 * cursor) just finished an action, so set the timer to mark
 * the timer as having a stop time.
 */
TraceSegment.prototype.touch = function touch() {
  this.timer.touch()
}

TraceSegment.prototype.overwriteDurationInMillis = overwriteDurationInMillis
function overwriteDurationInMillis(duration, start) {
  this.timer.overwriteDurationInMillis(duration, start)
}

TraceSegment.prototype.start = function start() {
  this.timer.begin()
}

/**
 * Stop timing the related action.
 */
TraceSegment.prototype.end = function end() {
  if (!this.timer.isActive()) {
    return
  }
  this.timer.end()
}

TraceSegment.prototype.finalize = function finalize(trace) {
  if (this.timer.softEnd()) {
    // timer.softEnd() returns true if the timer was ended prematurely, so
    // in that case we can name the segment as truncated
    this.name = NAMES.TRUNCATED.PREFIX + this.name
  }

  this.addAttribute('nr_exclusive_duration_millis', this.getExclusiveDurationInMillis(trace))
}

/**
 * Test to see if underlying timer is still active
 *
 * @returns {boolean} true if no longer active, else false.
 */
TraceSegment.prototype._isEnded = function _isEnded() {
  return !this.timer.isActive() || this.timer.touched
}

/**
 * Set the duration of the segment explicitly.
 *
 * @param {number} duration Duration in milliseconds.
 */
TraceSegment.prototype.setDurationInMillis = setDurationInMillis

function setDurationInMillis(duration, start) {
  this.timer.setDurationInMillis(duration, start)
}

TraceSegment.prototype.getDurationInMillis = function getDurationInMillis() {
  return this.timer.getDurationInMillis()
}

/**
 * @param {number} duration Milliseconds of exclusive duration.
 */
TraceSegment.prototype._setExclusiveDurationInMillis = _setExclusiveDurationInMillis

function _setExclusiveDurationInMillis(duration) {
  this._exclusiveDuration = duration
}

/**
 * Calculate, and cache, exclusive duration for a segment which is segment duration - overlap with merged child ranges
 * @param {Array} childPairs list of non-overlapping start/end times of the segment's children [start, end]
 */
TraceSegment.prototype.calculateExclusiveDuration = function calculateExclusiveDuration(childPairs) {
  if (this._exclusiveDuration) {
    return
  }

  const duration = this.getDurationInMillis()
  const end = this.timer.start + duration
  let exclusive = duration
  for (const [childStart, childEnd] of childPairs) {
    if (childStart >= end) {
      break
    }
    exclusive -= Math.min(childEnd, end) - childStart
  }
  this._setExclusiveDurationInMillis(exclusive)
}

/**
 * The duration of the transaction trace tree that only this level accounts
 * for.
 *
 * @returns {number} The amount of time the trace took, minus any child
 *                   segments, in milliseconds.
 */
TraceSegment.prototype.getExclusiveDurationInMillis = getExclusiveDurationInMillis

function getExclusiveDurationInMillis(trace) {
  if (this._exclusiveDuration == null) {
    // This will compute all exclusive durations for segments in tree
    trace._computeTotalTime()
  }
  return this._exclusiveDuration
}

/**
 * Adds all the relevant segment attributes for an External http request
 *
 * Note: for hostname, port, and `request.parameters.*` they are added as span attributes
 * only since these will get assigned when constructing SpanEvents from segment.
 *
 * @param {object} params function params
 * @param {string} params.protocol protocol of request(i.e. `http:`, `grpc:`)
 * @param {string} params.hostname hostname of request(no port)
 * @param {string} params.host host of request(hostname + port)
 * @param {string} params.port port of request if applicable
 * @param {string} params.path uri of request
 * @param {string} [params.method] method of request
 * @param {object} [params.queryParams] query parameters of request
 */
TraceSegment.prototype.captureExternalAttributes = function captureExternalAttributes({
  protocol,
  hostname,
  host,
  port,
  path,
  method = 'GET',
  queryParams = {}
}) {
  for (const key in queryParams) {
    this.addSpanAttribute(`request.parameters.${key}`, queryParams[key])
  }

  this.addSpanAttribute('hostname', hostname)
  this.addSpanAttribute('port', port)
  this.addAttribute('url', `${protocol}//${host}${path}`)
  this.addAttribute('procedure', method)
}

/**
 * Adds SpanLink event to TraceSegment unless the size limit has been reached
 *
 * @param {SpanLink} spanLink to add to TraceSegment
 * @returns {boolean} if span link was added or not
 */
TraceSegment.prototype.addSpanLink = function addSpanLink(spanLink) {
  if (this.spanLinks.length === 100) {
    this.logger.trace({ spanLink }, 'Span links limit reached. Not adding new link.')
    return false
  }
  this.spanLinks.push(spanLink)
  return true
}

/**
 * Adds TimedEvent event to TraceSegment unless the size limit has been reached
 *
 * @param {TimedEvent} timedEvent to add to TraceSegment
 * @returns {boolean} if timed event was added or not
 */
TraceSegment.prototype.addTimedEvent = function addTimedEvent(timedEvent) {
  if (this.timedEvents.length === 100) {
    this.logger.trace({ timedEvent }, 'Timed event limit reached. Not adding new event.')
    return false
  }
  this.timedEvents.push(timedEvent)
  return true
}

module.exports = TraceSegment
