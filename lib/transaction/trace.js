'use strict';

var path        = require('path')
  , codec       = require(path.join(__dirname, '..', 'util', 'codec'))
  , sumChildren = require(path.join(__dirname, '..', 'util', 'sum-children'))
  , Segment     = require(path.join(__dirname, 'trace', 'segment'))
  ;

/**
 * A Trace holds the root of the Segment graph and preoduces the final
 * serialization of the transaction trace.
 *
 * @param {Transaction} transaction The transaction bound to the trace.
 */
function Trace(transaction) {
  if (!transaction) throw new Error('All traces must be associated with a transaction.');

  this.transaction = transaction;

  this.root = new Segment(this, 'ROOT');
}

/**
 * End and close the current trace.
 */
Trace.prototype.end = function () {
  this.root.end();
};

/**
 * Add a child to the list of segments.
 *
 * @param {string} childName Name for the new segment.
 * @returns {Segment} Newly-created Segment.
 */
Trace.prototype.add = function (childName, callback) {
  return this.root.add(childName, callback);
};

/**
 * Add a child to the list of segments from an URL.
 *
 * @param {string} requestURL URL for the new segment.
 * @returns {Segment} Newly-created Segment.
 */
Trace.prototype.addWeb = function (requestURL, callback) {
  return this.root.addWeb(requestURL, callback);
};

/**
 * Explicitly set a trace's runtime instead of using it as a stopwatch.
 * (As a byproduct, stops the timer.)
 *
 * @param {int} duration Duration of this particular trace.
 * @param {int} startTimeInMillis (optional) Start of this trace.
 */
Trace.prototype.setDurationInMillis = function (duration, startTimeInMillis) {
  this.root.setDurationInMillis(duration, startTimeInMillis);
};

/**
 * @return {integer} The amount of time the trace took, in milliseconds.
 */
Trace.prototype.getDurationInMillis = function () {
  return this.root.getDurationInMillis();
};

/**
 * The duration of the transaction trace tree that only this level accounts
 * for.
 *
 * @return {integer} The amount of time the trace took, minus any child
 *                   traces, in milliseconds.
 */
Trace.prototype.getExclusiveDurationInMillis = function () {
  var total = this.getDurationInMillis();

  if (this.root.children.length > 0) {
    // convert the list of start, duration pairs to start, end pairs
    var timePairs = this.root.children.map(function (segment) {
      return segment.timer.toRange();
    });

    total -= sumChildren(timePairs);
  }

  return total;
};

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
 * 2: FIXME: a dictionary containing custom parameters
 * 3: the transaction trace segments (including the aforementioned root node)
 * 4: FIXME: a dictionary containing "parameter groups" with special information
 *    related to this trace
 *
 * @param {Function} callback Called after serialization with either
 *                            an error (in the first parameter) or
 *                            the serialized transaction trace.
 */
Trace.prototype.generateJSON = function (callback) {
  var start      = 0;
  var end        = this.getDurationInMillis();
  var parameters = this.parameters || {};

  var rootNode = [
    this.root.timer.start / 1000,
    parameters,
    {}, // FIXME: custom parameters
    this.root.toJSON(),
    []  // FIXME: parameter groups
  ];

  codec.encode(rootNode, function (err, encoded) {
    if (err) return callback(err);

    var json = [
      this.root.timer.start,
      this.getDurationInMillis(),
      this.transaction.scope,
      this.transaction.url,
      encoded,
      '',   // FIXME: RUM
      null, // NOTE: reserved for future use
      false // FIXME: RUM2
    ];

    return callback(null, json);
  }.bind(this));
};

module.exports = Trace;
