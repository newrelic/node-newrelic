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
function Probe(trace, name) {
  if (!trace) throw new Error('Probes must be bound to a transaction trace.');
  if (!name) throw new Error('Probes must be named.');

  this.trace = trace;
  this.name = name;

  this.children = [];
  this.timer = new Timer();

  this.timer.begin();
}

Probe.prototype.end = function () {
  this.timer.end();
};

/**
 * Add a new probe to a scope implicitly bounded by this probe.
 *
 * @param {string} childName New human-readable name for the probe.
 * @returns {Probe} New nested Probe.
 */
Probe.prototype.add = function (childName) {
  var probe = new Probe(this, childName);
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

module.exports = Probe;
