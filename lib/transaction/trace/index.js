'use strict'

var codec   = require('../../util/codec')
var Segment = require('./segment')

/*
 *
 * CONSTANTS
 *
 */
var FROM_MILLIS = 1e-3

/**
 * A Trace holds the root of the Segment graph and produces the final
 * serialization of the transaction trace.
 *
 * @param {Transaction} transaction The transaction bound to the trace.
 */
function Trace(transaction) {
  if (!transaction) throw new Error('All traces must be associated with a transaction.')

  this.transaction = transaction
  this.recorders = []

  this.root = new Segment(this, 'ROOT')

  this.custom = {}
  this.intrinsics = {}
  this.segmentsSeen = 0

  // hidden class optimization
  this.parameters = {}
  this.domain     = null
}

/**
 * End and close the current trace. Triggers metric recording for trace
 * segments that support recording.
 */
Trace.prototype.end = function end() {
  this.root.end()
  this.record()
}

/**
 * The instrumentation associates metrics with the different kinds of trace
 * segments. The metrics recorders are dependent on the transaction name to
 * collect their scoped metrics, and so must wait for the transaction's
 * name to be finalized before the recording process. Segments are only
 * responsible for their own life cycle, so responsibility for understanding
 * when the transaction name has been finalized is handed off to the trace,
 * which for now defers running these recorders until the trace is ended.
 *
 * @param {Function} recorder The callback which records metrics. Takes a
 *                            single parameter, which is the transaction's
 *                            name.
 */
Trace.prototype.addRecorder = function addRecorder(recorder) {
  this.recorders.push(recorder)
}

/**
 * Run the metrics recorders for this trace. If the transaction's name /
 * scope hasn't been set yet, the recorder will be passed an undefined name,
 * and should be written to handle this.
 */
Trace.prototype.record = function record() {
  var name = this.transaction.name
  this.recorders.forEach(function cb_forEach(recorder) { recorder(name); }.bind(this))
}

/**
 * Add a child to the list of segments.
 *
 * @param {string} childName Name for the new segment.
 * @returns {Segment} Newly-created Segment.
 */
Trace.prototype.add = function add(childName, callback) {
  return this.root.add(childName, callback)
}

/**
 * Explicitly set a trace's runtime instead of using it as a stopwatch.
 * (As a byproduct, stops the timer.)
 *
 * @param {int} duration Duration of this particular trace.
 * @param {int} startTimeInMillis (optional) Start of this trace.
 */
Trace.prototype.setDurationInMillis = function setDurationInMillis(duration, startTimeInMillis) {
  this.root.setDurationInMillis(duration, startTimeInMillis)
}

/**
 * @return {integer} The amount of time the trace took, in milliseconds.
 */
Trace.prototype.getDurationInMillis = function getDurationInMillis() {
  return this.root.getDurationInMillis()
}

/**
 * The duration of the transaction trace tree that only this level accounts
 * for.
 *
 * @return {integer} The amount of time the trace took, minus any child
 *                   traces, in milliseconds.
 */
Trace.prototype.getExclusiveDurationInMillis = function getExclusiveDurationInMillis() {
  return this.root.getExclusiveDurationInMillis()
}

/**
 * The serializer is asynchronous, so serialization is as well.
 *
 * The transaction trace sent to the collector is a nested set of arrays. The
 * outermost array has the following fields, in order:
 *
 * 0: start time of the trace, in milliseconds
 * 1: duration, in milliseconds
 * 2: the path, or root metric name
 * 3: the URL (fragment) for this trace
 * 4: an array of segment arrays, deflated and then base64 encoded
 * 5: FIXME: the guid for this transaction, used to correlate across
 *    transactions (for now, to correlate with RUM sessions)
 * 6: reserved for future use, specified to be null for now
 * 7: FIXME: RUM2 force persist flag
 *
 * In addition, there is a "root node" (not the same as the first child, which
 * is a node with the special name ROOT and contents otherwise identical to the
 * top-level segment of the actual trace) with the following fields:
 *
 * 0: start time IN SECONDS
 * 1: a dictionary containing request parameters
 * 2: a dictionary containing custom parameters (currently not user-modifiable)
 * 3: the transaction trace segments (including the aforementioned root node)
 * 4: FIXME: a dictionary containing "parameter groups" with special information
 *    related to this trace
 *
 * @param {Function} callback Called after serialization with either
 *                            an error (in the first parameter) or
 *                            the serialized transaction trace.
 */
Trace.prototype.generateJSON = function generateJSON(callback) {
  var rootNode = [
    this.root.timer.start * FROM_MILLIS,
    {}, // moved to agentAttributes
    {
      // hint to RPM for how to display this trace's segments
      nr_flatten_leading: false
    }, // moved to userAttributes
    this.root.toJSON(),
    {
      agentAttributes : this.parameters,
      userAttributes  : this.custom,
      intrinsics      : this.intrinsics
    },
    []  // FIXME: parameter groups
  ]

  var trace = this
  codec.encode(rootNode, function cb_encode(err, encoded) {
    if (err) return callback(err, null, null)

    var json = [
      trace.root.timer.start,
      trace.getDurationInMillis(),
      trace.transaction.name,
      trace.transaction.url,
      encoded,
      '',   // FIXME: RUM
      null, // NOTE: reserved for future use
      false // FIXME: RUM2
    ]

    return callback(null, json, trace)
  })
}

module.exports = Trace
