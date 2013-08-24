'use strict';

/**
 * Container that knows whether it's being used in a debugging context. If
 * it's being used for debugging, there's a further level of indirection that
 * needs to be peeled off. Allows the non-debugging version of the tracer to
 * generate a lot fewer objects and generally be much simpler than the
 * debugging tracer.
 */
function State(transaction, segment, call, debug) {
  if (!transaction) throw new Error("State must be created with a transaction.");
  if (!segment) throw new Error("State must be created with a trace segment.");
  if (!call) throw new Error("State must be created with a handler function.");

  this.transaction = transaction;
  this.segment     = segment;
  this.call        = call;

  if (debug) this.debug = debug;
}

State.prototype.getTransaction = function () {
  var transaction = this.transaction;
  if (this.debug && transaction) return transaction.value;

  return transaction;
};

State.prototype.getSegment = function () {
  var segment = this.segment;
  if (this.debug && segment) return segment.value;

  return segment;
};

State.prototype.setSegment = function (segment) {
  if (this.debug && segment) {
    this.segment = this.transaction.addSegment(segment);
  }
  else {
    this.segment = segment;
  }
};

State.prototype.getCall = function () {
  var call = this.call;
  if (this.debug && call) return call.value;

  return call;
};

State.prototype.setCall = function (call) {
  if (this.debug && call) {
    this.call.value = call;
  }
  else {
    this.call = call;
  }
};

module.exports = State;
