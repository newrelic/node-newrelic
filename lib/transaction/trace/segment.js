'use strict';

var path        = require('path')
  , sumChildren = require(path.join(__dirname, '..', '..', 'util', 'sum-children'))
  , Timer       = require(path.join(__dirname, '..', '..', 'timer'))
  ;

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
  if (!trace) throw new Error('Trace segments must be bound to a transaction trace.');
  if (!name) throw new Error('Trace segments must be named.');

  this.trace = trace;
  this.name = name;

  if (recorder) this.trace.addRecorder(recorder.bind(null, this));

  this.parameters = {nr_async_wait : true};
  this.children = [];

  this.timer = new Timer();
  this.timer.begin();

  // hidden class optimization
  this.partialName = null;
  this._exclusiveDuration = null;
}

TraceSegment.prototype.end = function () {
  if (!this.timer.isActive()) return;

  this.timer.end();
};

/**
 * Add a new segment to a scope implicitly bounded by this segment.
 *
 * @param {string} childName New human-readable name for the segment.
 * @returns {TraceSegment} New nested TraceSegment.
 */
TraceSegment.prototype.add = function (childName, callback) {
  var segment = new TraceSegment(this.trace, childName, callback);
  this.children.push(segment);
  return segment;
};

/**
 * Set the duration of the segment explicitly.
 *
 * @param {Number} duration Duration in milliseconds.
 */
TraceSegment.prototype.setDurationInMillis = function (duration, start) {
  this.timer.setDurationInMillis(duration, start);
};

TraceSegment.prototype.getDurationInMillis = function () {
  return this.timer.getDurationInMillis();
};

/**
 * Only for testing!
 *
 * @param {number} duration Miliseconds of exclusive duration.
 */
TraceSegment.prototype._setExclusiveDurationInMillis = function (duration) {
  this._exclusiveDuration = duration;
};

/**
 * The duration of the transaction trace tree that only this level accounts
 * for.
 *
 * @return {integer} The amount of time the trace took, minus any child
 *                   segments, in milliseconds.
 */
TraceSegment.prototype.getExclusiveDurationInMillis = function () {
  if (this._exclusiveDuration) return this._exclusiveDuration;

  var total = this.getDurationInMillis()
    , range = this.timer.toRange()
    ;

  if (this.children.length > 0) {
    // convert the list of start, duration pairs to start, end pairs
    var timePairs = this.children.map(function (segment) {
      var pair = segment.timer.toRange();
      return [pair[0], Math.min(pair[1], range[1])];
    });
    total -= sumChildren(timePairs);
  }

  return total;
};

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
TraceSegment.prototype.toJSON = function () {
  var start = this.timer.startedRelativeTo(this.trace.root.timer);

  return [
    start,
    start + this.getDurationInMillis(),
    this.name,
    this.parameters,
    this.children.map(function (child) { return child.toJSON(); })
  ];
};

module.exports = TraceSegment;
