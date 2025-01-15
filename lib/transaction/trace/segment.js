/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { DESTINATIONS } = require('../../config/attribute-filter')
const Timer = require('../../timer')
const hashes = require('../../util/hashes')

const { Attributes } = require('../../attributes')
const ExclusiveCalculator = require('./exclusive-time-calculator')
const SpanContext = require('../../spans/span-context')

const NAMES = require('../../metrics/names')
const STATE = {
  EXTERNAL: 'EXTERNAL',
  CALLBACK: 'CALLBACK'
}
const ATTRIBUTE_SCOPE = 'segment'

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
 * @param {object} params.config agent config
 * @param {string} params.name Human-readable name for this segment (e.g. 'http', 'net', 'express',
 *  'mysql', etc).
 *  @param {number} params.parentId parent id of segment
 * @param {boolean} params.collect flag to collect as part of transaction trace
 * @param {TraceSegment} params.root root segment
 * @param {boolean} params.isRoot flag to indicate it is the root segment
 */
function TraceSegment({ config, name, collect, parentId, root, isRoot = false }) {
  this.isRoot = isRoot
  this.root = root
  this.name = name
  this.attributes = new Attributes(ATTRIBUTE_SCOPE)
  this.spansEnabled = config?.distributed_tracing?.enabled && config?.span_events?.enabled

  // Generate a unique id for use in span events.
  this.id = hashes.makeId()
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

TraceSegment.prototype.moveToCallbackState = function moveToCallbackState() {
  this.state = STATE.CALLBACK
}

TraceSegment.prototype.isInCallbackState = function isInCallbackState() {
  return this.state === STATE.CALLBACK
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
 * transaction.finalizeNameFromUri). To properly name apdex metrics during metric
 * recording, it's also necessary to copy the transaction's partial name. And
 * finally, marking the trace segment as being a web segment copies the
 * segment's parameters onto the transaction.
 * @param {Transaction} transaction The transaction to which this segment will be bound.
 */
TraceSegment.prototype.markAsWeb = function markAsWeb(transaction) {
  this.setNameFromTransaction(transaction)

  const traceAttrs = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
  Object.keys(traceAttrs).forEach((key) => {
    if (!this.attributes.has(key)) {
      this.addAttribute(key, traceAttrs[key])
    }
  })
}

/**
 * A segment attached to something evented (such as a database
 * cursor) just finished an action, so set the timer to mark
 * the timer as having a stop time.
 */
TraceSegment.prototype.touch = function touch() {
  this.timer.touch()
  this._updateRootTimer()
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
  this._updateRootTimer()
}

TraceSegment.prototype.finalize = function finalize(trace) {
  if (this.timer.softEnd()) {
    this._updateRootTimer()
    // timer.softEnd() returns true if the timer was ended prematurely, so
    // in that case we can name the segment as truncated
    this.name = NAMES.TRUNCATED.PREFIX + this.name
  }

  this.addAttribute('nr_exclusive_duration_millis', this.getExclusiveDurationInMillis(trace))
}

/**
 * Helper to set the end of the root timer to this segment's root if it is later
 * in time.
 */

TraceSegment.prototype._updateRootTimer = function _updateRootTimer() {
  const root = this.isRoot ? this : this.root
  if (this.timer.endsAfter(root.timer)) {
    const newDuration = this.timer.start + this.getDurationInMillis() - root.timer.start
    root.overwriteDurationInMillis(newDuration)
  }
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
 * Only for testing!
 *
 * @param {number} duration Milliseconds of exclusive duration.
 */
TraceSegment.prototype._setExclusiveDurationInMillis = _setExclusiveDurationInMillis

function _setExclusiveDurationInMillis(duration) {
  this._exclusiveDuration = duration
}

/**
 * The duration of the transaction trace tree that only this level accounts
 * for.
 *
 * @returns {integer} The amount of time the trace took, minus any child
 *                   segments, in milliseconds.
 */
TraceSegment.prototype.getExclusiveDurationInMillis = getExclusiveDurationInMillis

function getExclusiveDurationInMillis(trace) {
  if (this._exclusiveDuration == null) {
    // Calculate the exclusive time for the subtree rooted at `this`
    const calculator = new ExclusiveCalculator(this, trace)
    calculator.process()
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
 * @param [string] params.port port of request if applicable
 * @param {string} params.path uri of request
 * @param {string} [params.method] method of request
 * @param {object} [params.queryParams] query parameters of request
 * @param params.port
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

module.exports = TraceSegment
