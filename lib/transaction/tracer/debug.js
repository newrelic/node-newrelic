'use strict';

var path          = require('path')
  , cls           = require('continuation-local-storage')
  , dominion      = require(path.join(__dirname, '..', '..', 'dominion.js'))
  , util          = require('util')
  , State         = require(path.join(__dirname, 'state'))
  , NRTransaction = require(path.join(__dirname, '..', '..', 'transaction'))
  ;

/* Just in case something decides to use the production and
 * debugging tracers at the same time.
 */
var namespace = process.namespaces.__NR_tracer;
if (!namespace) namespace = cls.createNamespace("__NR_tracer");

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

Call.prototype.format = function () {
  return util.format("T%dS%dC%d",
                     this.segment.transaction.id,
                     this.segment.id,
                     this.id);
};


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

function Describer() {
  this.trace     = [];
  this.creations = [];
  this.wrappings = [];

  this.verbose   = [];
}

Describer.prototype.clone = function () {
  var cloned = new Describer();

  cloned.trace     = this.trace.slice();
  cloned.creations = this.creations.slice();
  cloned.wrappings = this.wrappings.slice();
  cloned.verbose   = this.verbose.slice();

  return cloned;
};

Describer.prototype.traceCall = function (direction, call) {
  var id = direction + call.format();

  this.trace.push(id);
  this.verbose.push(id);
};

Describer.prototype.traceCreation = function (type) {
  var creation = util.format("+%s", type[0]);

  this.creations.push(creation);
  this.verbose.push(creation);
};

Describer.prototype.traceWrapping = function (direction, type) {
  var wrapping = util.format("%s%s", direction, type);

  this.wrappings.push(wrapping);
  this.verbose.push(wrapping);
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
 * This version is optimized for debugging. A new version should be made
 * for production use without all of the internal tracing information
 * included.
 */
function Tracer(agent) {
  if (!agent) throw new Error("Must be initialized with an agent.");

  this.numTransactions = 0;
  this.agent           = agent;
  this.describer       = new Describer();
}

Tracer.prototype.getState = function () {
  return namespace.get('state');
};

Tracer.prototype.getTransaction = function () {
  var state = namespace.get('state');
  if (state) {
    var transaction = state.getTransaction();
    if (transaction && transaction.isActive()) return transaction;
  }
};

Tracer.prototype.createState = function (transaction, segment, handler) {
  var state = new State(transaction, segment, handler, true);
  if (dominion.available) dominion.add(this.agent.errors, state);

  return state;
};

Tracer.prototype.enter = function (state, describer) {
  describer.traceCall('->', state.call);
};

Tracer.prototype.exit = function (state, describer) {
  describer.traceCall('<-', state.call);
};

Tracer.prototype.addTransaction = function (value, describer) {
  this.numTransactions += 1;

  describer.traceCreation('Trace');
  return new Transaction(this.numTransactions, value, describer);
};

Tracer.prototype.addSegment = function (transaction, value, describer) {
  describer.traceCreation('Segment');
  return transaction.addSegment(value);
};

Tracer.prototype.addCall = function (segment, value, describer) {
  describer.traceCreation('Call');
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
  // if there's no handler, there's nothing to proxy.
  if (!handler) return;

  this.describer.traceWrapping('->', 'T outer');

  var self = this;
  var wrapped = function () {
    var describer = self.describer.clone();
    describer.traceWrapping('->', 'T inner');

    // don't nest transactions, reuse existing ones
    var value       = self.getTransaction() || new NRTransaction(self.agent)
      , transaction = self.addTransaction(value, describer)
      , segment     = self.addSegment(transaction, value.getTrace().root, describer)
      , call        = self.addCall(segment, handler, describer)
      , state       = self.createState(transaction, segment, call)
      ;

    state.describer = describer;
    /* NOICE HAX D00D
     *
     * Will leave the end state of the transaction, including the various
     * traces, attached to the transaction.
     */
    value.state = state;

    self.enter(state, describer);
    var context = namespace.createContext();
    context.state = state;
    var returned = self.monitor(namespace.bind(handler, context), this,
                                arguments, transaction);
    self.exit(state, describer);

    describer.traceWrapping('<-', 'T inner');
    return returned;
  };

  this.describer.traceWrapping('<-', 'T outer');
  return wrapped;
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
  // if there's no handler, there's nothing to proxy.
  if (!handler) return;

  this.describer.traceWrapping('->', 'S outer');

  var self = this;
  var wrapped = function () {
    // don't implicitly create transactions
    var state = self.getState();
    if (!state) return self.monitor(handler, this, arguments);

    var describer = state.describer;
    describer.traceWrapping('->', 'S inner');

    var segment = self.addSegment(state.transaction, state.segment.value, describer)
      , call    = self.addCall(segment, handler, describer)
      ;

    state = new State(state.transaction, segment, call, true);
    state.describer = describer;
    state.transaction.value.state = state;

    self.enter(state, describer);
    var context = namespace.createContext();
    context.state = state;
    var returned = self.monitor(namespace.bind(handler, context), this,
                                arguments, state.getTransaction());
    self.exit(state, describer);

    describer.traceWrapping('<-', 'S inner');
    return returned;
  };

  this.describer.traceWrapping('<-', 'S outer');
  return wrapped;
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
  // if there's no handler, there's nothing to proxy.
  if (!handler) return;

  // don't implicitly create transactions
  var state = this.getState();
  if (!state) return handler;

  var describer = state.describer;
  describer.traceWrapping('->', 'C outer');

  var call = this.addCall(state.call.segment, handler, describer);

  var self = this;
  var wrapped = function () {
    describer.traceWrapping('->', 'C inner');
    state = new State(state.transaction, state.segment, call, true);
    state.describer = describer;
    state.transaction.value.state = state;

    self.enter(state, describer);
    var context = namespace.createContext();
    context.state = state;
    var returned = self.monitor(namespace.bind(handler, context), this,
                                arguments, state.transaction.value);
    self.exit(state, describer);

    describer.traceWrapping('<-', 'C inner');
    return returned;
  };

  describer.traceWrapping('<-', 'C outer');
  return wrapped;
};

/**
 * Transaction tracer's lifecycle may not match error tracer's, so don't
 * hold onto direct references to it.
 */
Tracer.prototype.monitor = function (handler, context, args, transaction) {
  return this.agent.errors.monitor(
    function () {
      return handler.apply(context, args);
    },
    transaction
  );
};

module.exports = Tracer;
