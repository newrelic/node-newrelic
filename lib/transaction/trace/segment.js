'use strict';

var path  = require('path')
  , url   = require('url')
  , Timer = require(path.join(__dirname, '..', '..', 'timer'))
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
 */
function TraceSegment(trace, name, callback) {
  if (!trace) throw new Error('Trace segments must be bound to a transaction trace.');
  if (!name) throw new Error('Trace segments must be named.');

  this.trace = trace;
  this.name = name;
  if (callback) {
    this.callback = callback;
    this.trace.transaction.addReporter();
  }

  this.children = [];

  this.timer = new Timer();
  this.timer.begin();
}

TraceSegment.prototype.end = function () {
  if (!this.timer.isActive()) return;

  this.timer.end();
  if (this.callback) {
    this.callback(this, this.name);
    this.trace.transaction.reportFinished();
  }
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
 * Add a new segment based on a URL as a child of this segment.
 *
 * @param {string} requestURL The URL from the incoming request.
 * @returns {TraceSegment} New nested TraceSegment.
 */
TraceSegment.prototype.addWeb = function (requestURL, callback) {
  var parsed  = url.parse(requestURL, true);
  var segment = this.add('WebTransaction/Uri' + parsed.pathname, callback);

  if (parsed.search !== '') {
    segment.parameters = {};
    Object.keys(parsed.query).forEach(function (key) {
      /* 'var1&var2=value' is not necessarily the same as 'var1=&var2=value'
       *
       * In my world, one is an assertion of presence, and the other is
       * an empty variable. Some web frameworks behave this way as well,
       * so don't lose information.
       *
       * TODO: figure out if this confuses everyone and remove if so.
       */
      if (parsed.query[key] === '' && parsed.path.indexOf(key + '=') < 0) {
        segment.parameters[key] = true;
      }
      else {
        segment.parameters[key] = parsed.query[key];
      }
    });
    this.trace.parameters = segment.parameters;
  }

  return segment;
};

/**
 * Set the duration of the segment explicitly.
 *
 * @param {Number} duration Duration in milliseconds.
 */
TraceSegment.prototype.setDurationInMillis = function (duration, start) {
  // for now, explicitly setting start time is only done
  // by test code, but the non-hacky solution is still to
  // make the segment's offset relative to the overall trace
  // start time.
  if (start || start === 0) start = this.trace.root.timer.start + start;

  this.timer.setDurationInMillis(duration, start);
};

TraceSegment.prototype.getDurationInMillis = function () {
  return this.timer.getDurationInMillis();
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
  var start = this.timer.start - this.trace.root.timer.start;
  var parameters = this.parameters || {};

  return [
    start,
    start + this.getDurationInMillis(),
    this.name,
    parameters,
    this.children.map(function (child) {
      return child.toJSON();
    })
  ];
};

module.exports = TraceSegment;
