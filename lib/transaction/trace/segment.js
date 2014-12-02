'use strict'

var path        = require('path')
  , util        = require('util')
  , urltils     = require('../../util/urltils.js')
  , sumChildren = require('../../util/sum-children')
  , Timer       = require('../../timer')


var STATE = {
  EXTERNAL: 'EXTERNAL',
  CALLBACK: 'CALLBACK',
}

/**
 * TraceSegments are inserted to track instrumented function calls. Each one is
 * bound to a trace, given a name (used only internally to the framework
 * for now), and has one or more children (that are also part of the same
 * trace), as well as an associated timer.
 *
 * @param {Trace} trace The transaction trace to which this segment will be
 *                      bound.
 * @param {string} name Human-readable name for this segment (e.g. 'http',
 *                      'net', 'express', 'mysql', etc).
 * @param {Function} recorder Callback that takes a segment and a scope name
 *                            as parameters (intended to be used to record
 *                            metrics related to the segment).
 */
function TraceSegment(trace, name, recorder) {
  if (!trace) throw new Error('Trace segments must be bound to a transaction trace.')
  if (!name) throw new Error('Trace segments must be named.')

  this.trace = trace
  this.name = name

  if (recorder) this.trace.addRecorder(recorder.bind(null, this))

  this.parameters = {nr_exclusive_duration_millis : null}
  this.children = []

  this.timer = new Timer()
  this.timer.begin()

  // hidden class optimization
  this.partialName = null
  this._exclusiveDuration = null
  this.host = null
  this.port = null
  this.state = STATE.EXTERNAL
}

TraceSegment.prototype.moveToCallbackState = function moveToCallbackState() {
  this.state = STATE.CALLBACK
}

TraceSegment.prototype.isInCallbackState = function isInCallbackState() {
  return this.state === STATE.CALLBACK
}

/**
 * Once a transaction is named, the web segment also needs to be updated to
 * match it (which implies this method must be called subsequent to
 * transaction.setName). To properly name apdex metrics during metric
 * recording, it's also necessary to copy the transaction's partial name. And
 * finally, marking the trace segment as being a web segment copies the
 * segment's parameters onto the transaction.
 *
 * @param {string} rawURL The URL, as it came in, for parameter extraction.
 */
TraceSegment.prototype.markAsWeb = function markAsWeb(rawURL) {
  var transaction = this.trace.transaction

  // transaction name and web segment name must match
  this.name = transaction.name
  // partialName is used to name apdex metrics when recording
  this.partialName = transaction.partialName

  var config = this.trace.transaction.agent.config

  // Copy params object so we can modify it before applying it
  // multiple params places. It eventually runs through copyParameters
  // so I'm not worried about `ignored_params` or `capture_params`.
  var params = util._extend({}, this.parameters)

  // This shouldn't be moved from the segment to the trace, so remove it.
  delete params.nr_exclusive_duration_millis

  // Because we are assured we have the URL here, lets grab query params. Same
  // as above, about to be run through copyParameters, so opt for the faster
  // object merge/copy.
  util._extend(params, urltils.parseParameters(rawURL))

  urltils.copyParameters(config, params, this.parameters)
  urltils.copyParameters(config, params, this.trace.parameters)

}

/**
 * A segment attached to something evented (such as a database
 * cursor) just finished an action, so set the timer to mark
 * the timer as having a stop time.
 */
TraceSegment.prototype.touch = function touch() {
  this.timer.touch()
}

/**
 * Stop timing the related action.
 */
TraceSegment.prototype.end = function end() {
  if (!this.timer.isActive()) return

  this.timer.end()
}

/**
 * Test to see if underlying timer is still active
 *
 * @returns {boolean} true if no longer active, else false.
 */
TraceSegment.prototype._isEnded = function _isEnded() {
  return !this.timer.isActive()
}

/**
 * Add a new segment to a scope implicitly bounded by this segment.
 *
 * @param {string} childName New human-readable name for the segment.
 * @returns {TraceSegment} New nested TraceSegment.
 */
TraceSegment.prototype.add = function add(childName, callback) {
  var segment = new TraceSegment(this.trace, childName, callback)
  var config = this.trace.transaction.agent.config

  if(this.trace.segmentsSeen++ < config.max_trace_segments) {
    this.children.push(segment)
  }
  return segment
}

/**
 * Set the duration of the segment explicitly.
 *
 * @param {Number} duration Duration in milliseconds.
 */
TraceSegment.prototype.setDurationInMillis = function setDurationInMillis(duration, start) {
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
TraceSegment.prototype._setExclusiveDurationInMillis = function _setExclusiveDurationInMillis(duration) {
  this._exclusiveDuration = duration
}

/**
 * The duration of the transaction trace tree that only this level accounts
 * for.
 *
 * @return {integer} The amount of time the trace took, minus any child
 *                   segments, in milliseconds.
 */
TraceSegment.prototype.getExclusiveDurationInMillis = function getExclusiveDurationInMillis() {
  if (this._exclusiveDuration) return this._exclusiveDuration

  var total = this.getDurationInMillis()
    , end   = this.timer.toRange()[1]


  if (this.children.length > 0) {
    // convert the list of start, duration pairs to start, end pairs
    total -= sumChildren(this._getChildPairs(end))
  }

  return total
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

  var seed = this.children.map(function cb_map(segment) {
    return segment.timer.toRange()
  })

  return this.children
    .reduce(function cb_reduce(pairs, segment) {
      return pairs.concat(segment._getChildPairs(end))
    }, seed)
    .filter(function cb_filter(pair) {
      return pair[0] < end
    })
    .map(function cb_map(pair) {
      // FIXME: heuristically limit intervals to the end of the parent segment
      return [pair[0], Math.min(pair[1], end)]
    })
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
  var start = this.timer.startedRelativeTo(this.trace.root.timer)
  if (!this.parameters.nr_exclusive_duration_millis) {
    this.parameters.nr_exclusive_duration_millis = this.getExclusiveDurationInMillis()
  }

  return [
    start,
    start + this.getDurationInMillis(),
    this.name,
    this.parameters,
    this.children.map(function cb_map(child) { return child.toJSON(); })
  ]
}

module.exports = TraceSegment
