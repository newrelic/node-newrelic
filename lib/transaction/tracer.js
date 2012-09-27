'use strict';

var path = require('path')
  , util = require('util')
  ;

/**
 *
 *
 * THE MODEL:
 *
 * A simple set of classes intended to model a call chain within the scope of
 * a New Relic transaction trace. The players are transactions (e.g. web page
 * requests), trace segments for subsidiary calls (e.g. database or memcached
 * calls), and instrumented callbacks.
 *
 * The goal is to be able to model the scenarios outlined in the test cases,
 * copied up here for easy reference:
 *
 * a. direct function execution
 * b. an asynchronous function -- that is, a function that returns a callback,
 *    that can be executed at an arbitrary future time
 * c. two overlapping executions of an asynchronous function and its callback
 * d. direct function execution, including direct execution of an instrumented
 *    subsidiary function
 * e. an asynchronous function that calls an asynchronous subsidiary function
 * f. two overlapping executions of an asynchronous function with an
 *    asynchronous subsidiary function
 *
 * Here are some of the rules the model is intended to follow:
 *
 * 1. Every call, segment, and transaction has an ID (for the purposes of these
 *    tests, that ID is derived from how many of each thing are associated
 *    with a given trace).
 * 2. Every Call is associated with a Segment.
 * 3. Every Segment is associated with a Trace.
 *
 *
 */

/**
 * CALL
 */
function Call(id, segment, value) {
  if (!id) throw new Error("Calls must have an ID.");
  if (!segment) throw new Error("Calls must be associated with a segment.");
  if (!value) throw new Error("Calls must be associated with a segment value.");

  this.id      = id;
  this.segment = segment;
  this.value   = value;
}

/**
 * SEGMENT
 */
function Segment(id, transaction, value) {
  if (!id) throw new Error("Segments must have an ID.");
  if (!transaction) throw new Error("Segments must be associated with a transaction.");
  if (!value) throw new Error("Segments must be associated with a value.");

  this.id          = id;
  this.transaction = transaction;
  this.value       = value;

  this.numCalls = 0;
}

Segment.prototype.addCall = function (value) {
  this.numCalls += 1;
  return new Call(this.numCalls, this, value);
};


/**
 * TRANSACTION
 */
function Transaction (id, value) {
  if (!id) throw new Error("Transactions must have an ID.");
  if (!value) throw new Error("Transactions must be associated with a value.");

  this.id    = id;
  this.value = value;

  this.numSegments = 0;
}

Transaction.prototype.addSegment = function (value) {
  this.numSegments += 1;
  return new Segment(this.numSegments, this, value);
};

/**
 * EXECUTION TRACER
 *
 * One instance of this class exists per transaction, with the state
 * representing the current context shared between multiple instances.
 *
 * The transaction tracer works by wrapping either the generator functions
 * that asynchronously handle incoming requests (via
 * Tracer.transactionProxy and Tracer.segmentProxy) or direct function
 * calls in the form of callbacks (via Tracer.callbackProxy).
 *
 * In both cases, the wrappers exist to set up the execution context for
 * the wrapped functions. The context is effectively global, and works in
 * a manner similar to Node 0.8's domains, by explicitly setting up and
 * tearing down the current transaction / segment / call around each
 * wrapped function's invocation. It relies upon the fact that Node is
 * single-threaded, and requires that each entry and exit be paired
 * appropriately so that the context is left in its proper state.
 *
 * This version is optimized for production. For debugging purposes,
 * use transaction/tracer/debug.js.
 */
function Tracer(agent, context) {
  if (!agent) throw new Error("Must be initialized with an agent.");
  if (!context) throw new Error("Must include shared context.");

  this.numTransactions = 0;
  this.agent           = agent;
  this.context         = context;
}

Tracer.prototype.addTransaction = function (value) {
  this.numTransactions += 1;

  return new Transaction(this.numTransactions, value);
};

Tracer.prototype.addSegment = function (transaction, value) {
  return transaction.addSegment(value);
};

Tracer.prototype.addCall = function (segment, value) {
  return segment.addCall(value);
};

/**
 * Use transactionProxy to wrap a closure that is a top-level handler that is
 * meant to originate transactions. This is meant to wrap the first half of
 * async calls, not their callbacks.
 *
 * @param {Function} handler Generator to be proxied.
 * @returns {Function} Proxied function.
 */
Tracer.prototype.transactionProxy = function (handler) {
  var self = this;
  return function wrapTransactionInvocation() {
    var value       = self.agent.createTransaction()
      , transaction = self.addTransaction(value)
      , segment     = self.addSegment(transaction, value.getTrace().root)
      , call        = self.addCall(segment, handler)
      ;

    var state = {
      transaction : transaction,
      segment     : segment,
      call        : call
    };

    self.context.enter(state);
    var returned = handler.apply(this, arguments);
    self.context.exit(state);

    return returned;
  };
};

/**
 * Use segmentProxy to wrap a closure that is a top-level handler that is
 * meant to participate in an existing transaction. It will add itself as a
 * new subsidiary to the current transaction. This is meant to wrap the first
 * half of async calls, not their callbacks.
 *
 * @param {Function} handler Generator to be proxied.
 * @returns {Function} Proxied function.
 */
Tracer.prototype.segmentProxy = function (handler) {
  var self = this;
  return function wrapSegmentInvocation() {
    // don't implicitly create transactions
    var state = self.context.state;
    if (!state) return handler.apply(this, arguments);

    var segment = self.addSegment(state.transaction, state.segment.value)
      , call    = self.addCall(segment, handler)
      ;

    state = {
      transaction : state.transaction,
      segment     : segment,
      call        : call
    };

    self.context.enter(state);
    var returned = handler.apply(this, arguments);
    self.context.exit(state);

    return returned;
  };
};

/**
 * Use callbackProxy to wrap a closure that may invoke subsidiary functions that
 * want access to the current transaction. When called, it sets up the correct
 * context before invoking the original function (and tears it down afterwards).
 *
 * Proxying of individual calls is only meant to be done within the scope of
 * an existing transaction. It
 *
 * @param {Function} handler Function to be proxied on invocation.
 * @returns {Function} Proxied function.
 */
Tracer.prototype.callbackProxy = function (handler) {
  // don't implicitly create transactions
  var state = this.context.state;
  if (!state) return handler;

  var call = this.addCall(state.call.segment, handler);

  var self = this;
  return function wrapCallbackInvocation() {
    state = {
      transaction : state.transaction,
      segment     : state.segment,
      call        : call
    };

    self.context.enter(state);
    var returned = handler.apply(this, arguments);
    self.context.exit(state);

    return returned;
  };
};

module.exports = Tracer;
