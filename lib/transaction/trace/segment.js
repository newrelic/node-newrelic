/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { DESTINATIONS } = require('../../config/attribute-filter')
const logger = require('../../logger').child({ component: 'segment' })
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
 * TraceSegments are inserted to track instrumented function calls. Each one is
 * bound to a transaction, given a name (used only internally to the framework
 * for now), and has one or more children (that are also part of the same
 * transaction), as well as an associated timer.
 * @param config The agent config.
 * @param {string} name
 * @param {boolean} collect
 * @param traceStacks
 *  Human-readable name for this segment (e.g. 'http', 'net', 'express',
 *  'mysql', etc).
 */
function TraceSegment(config, name, collect, traceStacks) {
  this.name = name
  this.attributes = new Attributes(ATTRIBUTE_SCOPE)
  this.config = config
  this.children = []

  // Generate a unique id for use in span events.
  this.id = hashes.makeId()
  this.timer = new Timer()

  this.internal = false
  this.opaque = false
  this.shim = null

  // hidden class optimization
  this.partialName = null
  this._exclusiveDuration = null
  this._collect = collect || true
  this.host = null
  this.port = null
  this.state = STATE.EXTERNAL
  this.async = true
  this.ignore = false
  this.traceStacks = traceStacks

  this.traceStacks.probe('new TraceSegment', { segment: this.name })
}

TraceSegment.prototype.getSpanContext = function getSpanContext() {
  const config = this.config
  const spansEnabled = this.config.distributed_tracing.enabled && config.span_events.enabled

  if (!this._spanContext && spansEnabled) {
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
  const enabled = this.config.span_events.enabled && this.config.distributed_tracing.enabled
  if (enabled) {
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
 * @param transaction The transaction.
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
 * @param transaction The transaction.
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
 * @param transaction
 */
TraceSegment.prototype.touch = function touch(transaction) {
  this.traceStacks.probe('Touched', { segment: this.name })
  this.timer.touch()
  this._updateRootTimer(transaction)
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
 * @param transaction
 */
TraceSegment.prototype.end = function end(transaction) {
  if (!this.timer.isActive()) {
    return
  }
  this.traceStacks.probe('Ended', { segment: this.name })
  this.timer.end()
  this._updateRootTimer(transaction)
}

TraceSegment.prototype.finalize = function finalize(transaction) {
  if (this.timer.softEnd()) {
    this._updateRootTimer(transaction)
    // timer.softEnd() returns true if the timer was ended prematurely, so
    // in that case we can name the segment as truncated
    this.name = NAMES.TRUNCATED.PREFIX + this.name
  }

  this.addAttribute('nr_exclusive_duration_millis', this.getExclusiveDurationInMillis())
}

/**
 * Helper to set the end of the root timer to this segment's root if it is later
 * in time.
 */

TraceSegment.prototype._updateRootTimer = function _updateRootTimer(transaction) {
  const root = transaction.trace.root
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
 * Add a new segment to a scope implicitly bounded by this segment.
 *
 * @param config The agent config.
 * @param {string} childName New human-readable name for the segment.
 * @param collect
 * @param traceStacks
 * @returns {TraceSegment} New nested TraceSegment.
 */
TraceSegment.prototype.add = function add(config, childName, collect, traceStacks) {
  if (this.opaque) {
    logger.trace('Skipping child addition on opaque segment')
    return this
  }
  const segment = new TraceSegment(config, childName, collect, traceStacks)

  this.children.push(segment)

  if (config.debug && config.debug.double_linked_transactions) {
    segment.parent = this
  }

  return segment
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

function getExclusiveDurationInMillis() {
  if (this._exclusiveDuration == null) {
    // Calculate the exclusive time for the subtree rooted at `this`
    const calculator = new ExclusiveCalculator(this)
    calculator.process()
  }
  return this._exclusiveDuration
}

TraceSegment.prototype.getChildren = function getChildren() {
  const children = []
  for (let i = 0, len = this.children.length; i < len; ++i) {
    if (!this.children[i].ignore) {
      children.push(this.children[i])
    }
  }
  return children
}

TraceSegment.prototype.getCollectedChildren = function getCollectedChildren() {
  const children = []
  for (let i = 0, len = this.children.length; i < len; ++i) {
    if (this.children[i]._collect && !this.children[i].ignore) {
      children.push(this.children[i])
    }
  }
  return children
}

/**
 * Enumerate the timings of this segment's descendants.
 *
 * @param {number} end The end of this segment, to keep the calculated
 *                     duration from exceeding the duration of the
 *                     parent. Defaults to Infinity.
 * @returns {Array} Unsorted list of [start, end] pairs, with no pair
 *                  having an end greater than the passed in end time.
 */
TraceSegment.prototype._getChildPairs = function _getChildPairs(end) {
  // quick optimization
  if (this.children.length < 1) {
    return []
  }
  if (!end) {
    end = Infinity
  }

  let children = this.getChildren()
  const childPairs = []
  while (children.length) {
    const child = children.pop()
    const pair = child.timer.toRange()

    if (pair[0] >= end) {
      continue
    }

    children = children.concat(child.getChildren())

    pair[1] = Math.min(pair[1], end)
    childPairs.push(pair)
  }

  return childPairs
}

/**
 * This is perhaps the most poorly-documented element of transaction traces:
 * what do each of the segment representations look like prior to encoding?
 * Spelunking in the code for the other agents has revealed that each child
 * node is an array with the following field in the following order:
 *
 * 0: entry timestamp relative to transaction start time
 * 1: exit timestamp
 * 2: metric name
 * 3: parameters as a name -> value JSON dictionary
 * 4: any child segments
 *
 * Other agents include further fields in this. I haven't gotten to the bottom
 * of all of them (and Ruby, of course, sends marshalled Ruby object), but
 * here's what I know so far:
 *
 * in Java:
 * 5: class name
 * 6: method name
 *
 * in Python:
 * 5: a "label"
 *
 * FIXME: I don't know if it makes sense to add custom fields for Node. TBD
 * @param transaction
 */
TraceSegment.prototype.toJSON = function toJSON(transaction) {
  // use depth-first search on the segment tree using stack
  const resultDest = []
  // array of objects relating a segment and the destination for its
  // serialized data.
  const segmentsToProcess = [
    {
      segment: this,
      destination: resultDest
    }
  ]

  while (segmentsToProcess.length !== 0) {
    const { segment, destination } = segmentsToProcess.pop()

    const start = segment.timer.startedRelativeTo(transaction.trace.root.timer)
    const duration = segment.getDurationInMillis()

    const segmentChildren = segment.getCollectedChildren()
    const childArray = []

    // push serialized data into the specified destination
    destination.push([start, start + duration, segment.name, segment.getAttributes(), childArray])

    if (segmentChildren.length) {
      // push the children and the parent's children array into the stack.
      // to preserve the chronological order of the children, push them
      // onto the stack backwards (so the first one created is on top).
      for (let i = segmentChildren.length - 1; i >= 0; --i) {
        segmentsToProcess.push({
          segment: segmentChildren[i],
          destination: childArray
        })
      }
    }
  }

  // pull the result out of the array we serialized it into
  return resultDest[0]
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
  // eslint-disable-next-line guard-for-in
  for (const key in queryParams) {
    this.addSpanAttribute(`request.parameters.${key}`, queryParams[key])
  }

  this.addSpanAttribute('hostname', hostname)
  this.addSpanAttribute('port', port)
  this.addAttribute('url', `${protocol}//${host}${path}`)
  this.addAttribute('procedure', method)
}

module.exports = TraceSegment
