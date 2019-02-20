'use strict'

const {DESTINATIONS} = require('../../config/attribute-filter')
const logger = require('../../logger').child({component: 'segment'})
const Timer = require('../../timer')
const urltils = require('../../util/urltils')
const hashes = require('../../util/hashes')

const Attributes = require('../../attributes')
const ExclusiveCalculator = require('./exclusive-time-calculator')

const NAMES = require('../../metrics/names')
const INSTANCE_UNKNOWN = 'unknown'
const STATE = {
  EXTERNAL: 'EXTERNAL',
  CALLBACK: 'CALLBACK'
}
const ATTRIBUTE_SCOPE = 'segment'


/**
 * Initializes the segment and binds the recorder to itself, if provided.
 *
 * @constructor
 * @classdesc
 * TraceSegments are inserted to track instrumented function calls. Each one is
 * bound to a transaction, given a name (used only internally to the framework
 * for now), and has one or more children (that are also part of the same
 * transaction), as well as an associated timer.
 *
 * @param {Transaction} transaction
 *  The transaction to which this segment will be bound.
 *
 * @param {string} name
 *  Human-readable name for this segment (e.g. 'http', 'net', 'express',
 *  'mysql', etc).
 *
 * @param {?function} recorder
 *  Callback that takes a segment and a scope name as attributes (intended to be
 *  used to record metrics related to the segment).
 */
function TraceSegment(transaction, name, recorder) {
  this.name = name
  this.transaction = transaction

  ++transaction.numSegments
  ++transaction.agent.totalActiveSegments
  ++transaction.agent.segmentsCreatedInHarvest

  if (recorder) {
    transaction.addRecorder(recorder.bind(null, this))
  }

  this.attributes = new Attributes(ATTRIBUTE_SCOPE)

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
  this._collect = true
  this.host = null
  this.port = null
  this.state = STATE.EXTERNAL
  this.async = true
  this.ignore = false

  this.probe('new TraceSegment')
}

TraceSegment.prototype.addAttribute =
function addAttribute(key, value, truncateExempt = false) {
  this.attributes.addAttribute(
    DESTINATIONS.SEGMENT_SCOPE,
    key,
    value,
    truncateExempt
  )
}

TraceSegment.prototype.getAttributes = function getAttributes() {
  return this.attributes.get(DESTINATIONS.TRANS_SEGMENT)
}

/**
 * @param {string} host
 *  The name of the host of the database. This will be normalized if the string
 *  represents localhost.
 *
 * @param {string|number} port
 *  The database's port, path to unix socket, or id.
 *
 * @param {string|number|bool} database
 *  The name or ID of the database that was connected to. Or `false` if there is
 *  no database name (i.e. Redis has no databases, only hosts).
 */
TraceSegment.prototype.captureDBInstanceAttributes = captureDBInstanceAttributes

function captureDBInstanceAttributes(host, port, database) {
  var config = this.transaction.agent.config
  var dsTracerConf = config.datastore_tracer

  // Add database name if provided and enabled.
  if (database !== false && dsTracerConf.database_name_reporting.enabled) {
    this.addAttribute(
      'database_name',
      typeof database === 'number' ? database : (database || INSTANCE_UNKNOWN)
    )
  }

  // Add instance information if enabled.
  if (dsTracerConf.instance_reporting.enabled) {
    // Determine appropriate defaults for host and port.
    port = port || INSTANCE_UNKNOWN
    if (host && urltils.isLocalhost(host)) {
      host = config.getHostnameSafe(host)
    }
    if (!host || host === 'UNKNOWN_BOX') { // Config's default name of a host.
      host = INSTANCE_UNKNOWN
    }

    this.addAttribute('host', host)
    this.addAttribute('port_path_or_id', String(port))
  }
}

TraceSegment.prototype.moveToCallbackState = function moveToCallbackState() {
  this.state = STATE.CALLBACK
}

TraceSegment.prototype.isInCallbackState = function isInCallbackState() {
  return this.state === STATE.CALLBACK
}

TraceSegment.prototype.probe = function probe(action) {
  if (this.transaction.traceStacks) {
    this.transaction.probe(action, {segment: this.name})
  }
}


/**
 * For use when a transaction is ending.  The transaction segment should
 * be named after the transaction it belongs to (which is only known by
 * the end).
 */
TraceSegment.prototype.setNameFromTransaction = function setNameFromTransaction() {
  var transaction = this.transaction

  // transaction name and transaciton segment name must match
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
 */
TraceSegment.prototype.markAsWeb = function markAsWeb() {
  var transaction = this.transaction
  this.setNameFromTransaction()

  var traceAttrs = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
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
  this.probe('Touched')
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
  if (!this.timer.isActive()) return
  this.probe('Ended')
  this.timer.end()
  this._updateRootTimer()
}

TraceSegment.prototype.finalize = function finalize() {
  if (this.timer.softEnd()) {
    this._updateRootTimer()
    // timer.softEnd() returns true if the timer was ended prematurely, so
    // in that case we can name the segment as truncated
    this.name = NAMES.TRUNCATED.PREFIX + this.name
  }

  this.addAttribute(
    'nr_exclusive_duration_millis',
    this.getExclusiveDurationInMillis()
  )
}

/**
 * Helper to set the end of the root timer to this segment's root if it is later
 * in time.
 */
TraceSegment.prototype._updateRootTimer = function _updateRootTimer() {
  var root = this.transaction.trace.root
  if (this.timer.endsAfter(root.timer)) {
    var newDuration = (
      this.timer.start +
      this.getDurationInMillis() -
      root.timer.start
    )
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
 * @param {string} childName New human-readable name for the segment.
 * @returns {TraceSegment} New nested TraceSegment.
 */
TraceSegment.prototype.add = function add(childName, recorder) {
  if (this.opaque) {
    logger.trace('Skipping child addition on opaque segment')
    return this
  }
  logger.trace('Adding segment %s to %s in %s', childName, this.name, this.transaction.id)
  var segment = new TraceSegment(this.transaction, childName, recorder)
  var config = this.transaction.agent.config

  if (this.transaction.trace.segmentsSeen++ >= config.max_trace_segments) {
    segment._collect = false
  }
  this.children.push(segment)

  if (config.debug && config.debug.double_linked_transactions) {
    segment.parent = this
  }

  return segment
}

/**
 * Set the duration of the segment explicitly.
 *
 * @param {Number} duration Duration in milliseconds.
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
 * @return {integer} The amount of time the trace took, minus any child
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
  var children = []
  for (var i = 0, len = this.children.length; i < len; ++i) {
    if (!this.children[i].ignore) {
      children.push(this.children[i])
    }
  }
  return children
}

TraceSegment.prototype.getCollectedChildren = function getCollectedChildren() {
  var children = []
  for (var i = 0, len = this.children.length; i < len; ++i) {
    if (this.children[i]._collect && !this.children[i].ignore) {
      children.push(this.children[i])
    }
  }
  return children
}

/**
 * Enumerate the timings of this segment's descendants.
 *
 * @param {Number} end The end of this segment, to keep the calculated
 *                     duration from exceeding the duration of the
 *                     parent. Defaults to Infinity.
 *
 * @returns {Array} Unsorted list of [start, end] pairs, with no pair
 *                  having an end greater than the passed in end time.
 */
TraceSegment.prototype._getChildPairs = function _getChildPairs(end) {
  // quick optimization
  if (this.children.length < 1) return []
  if (!end) end = Infinity

  var children = this.getChildren()
  var childPairs = []
  while (children.length) {
    var child = children.pop()
    var pair = child.timer.toRange()

    if (pair[0] >= end) continue

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
 */
TraceSegment.prototype.toJSON = function toJSON() {
  // use depth-first search on the segment tree using stack
  const resultDest = []
  // array of objects relating a segment and the destination for its
  // serialized data.
  const segmentsToProcess = [{
    segment: this,
    destination: resultDest
  }]

  while (segmentsToProcess.length !== 0) {
    const {segment, destination} = segmentsToProcess.pop()

    const start = segment.timer.startedRelativeTo(segment.transaction.trace.root.timer)
    const duration = segment.getDurationInMillis()

    const segmentChildren = segment.getCollectedChildren()
    const childArray = []

    // push serialized data into the specified destination
    destination.push([
      start,
      start + duration,
      segment.name,
      segment.getAttributes(),
      childArray
    ])

    if (segmentChildren.length) {
      // push the children and the parent's children array into the stack.
      // to preserve the chronological order of the children, push them
      // onto the stack backwards (so the first one created is on top).
      for (var i = segmentChildren.length - 1; i >= 0; --i) {
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

module.exports = TraceSegment
