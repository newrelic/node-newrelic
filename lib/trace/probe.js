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

Probe.prototype.finish = function () {
  this.timer.end();
};

module.exports = Probe;
