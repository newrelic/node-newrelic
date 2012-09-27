'use strict';

/**
 * Container that knows whether it's being used in a debugging context. If
 * it's being used for debugging, there's a further level of indirection that
 * needs to be peeled off. Allows the non-debugging version of the tracer to
 * generate a lot fewer objects and generally be much simpler than the
 * debugging tracer.
 */
function State(transaction, segment, call, debug) {
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

State.prototype.getCall = function () {
  var call = this.call;
  if (this.debug && call) return call.value;

  return call;
};

module.exports = State;
