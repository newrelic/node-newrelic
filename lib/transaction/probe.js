'use strict';

var path  = require('path')
  , Timer = require(path.join(__dirname, '..', 'timer'))
  ;

/**
 * Probes are inserted to track instrumented function calls. Each one is
 * bound to a trace, given a name (used only internally to the framework
 * for now), and has one or more children (that are also part of the same
 * trace), as well as an associated timer.
 *
 * @param {Trace} trace The transaction trace to which this probe will be
 *                      bound.
 * @param {string} name Human-readable name for this probe (e.g. 'http',
 *                      'net', 'express', 'mysql', etc).
 */
function Probe(trace, name, callback) {
  if (!trace) throw new Error('Probes must be bound to a transaction trace.');
  if (!name) throw new Error('Probes must be named.');

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

Probe.prototype.end = function () {
  this.timer.end();
  if (this.callback) {
    this.callback(this, this.name);
    this.trace.transaction.reportFinished();
  }
};

/**
 * Add a new probe to a scope implicitly bounded by this probe.
 *
 * @param {string} childName New human-readable name for the probe.
 * @returns {Probe} New nested Probe.
 */
Probe.prototype.add = function (childName, callback) {
  var probe = new Probe(this.trace, childName, callback);
  this.children.push(probe);
  return probe;
};

/**
 * Set the duration of the probe explicitly.
 *
 * @param {Number} duration Duration in milliseconds.
 */
Probe.prototype.setDurationInMillis = function (duration, start) {
  this.timer.setDurationInMillis(duration, start);
};

Probe.prototype.getDurationInMillis = function () {
  return this.timer.getDurationInMillis();
};

/**
 * This is perhaps the most poorly-documented element of transaction traces:
 * what do each of the segment representations look like prior to encoding?
 * Spelunking in the code for the other agents has revealed that each child
 * node is an array with the following field in the following order:
 *
 * 0: entry timestamp
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
 * 5: a "label" TODO: look up what that label is
 *
 * FIXME: I don't know if it makes sense to add custom fields for Node. TBD
 */
Probe.prototype.toJSON = function () {
  var children = this.children.map(function (child) {
    return child.toJSON();
  });

  return [
    this.timer.start,
    this.timer.start + this.getDurationInMillis(),
    this.name,
    '', // FIXME need to add the concept of parameters to the segment
    children
  ];
};

module.exports = Probe;
