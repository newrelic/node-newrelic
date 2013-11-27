'use strict';

var path          = require('path')
  , cls           = require('continuation-local-storage')
  , util          = require('util')
  , NRTransaction = require(path.join(__dirname, '..', '..', 'transaction'))
  , NRTracer      = require(path.join(__dirname, '..', 'tracer'))
  ;

/*
 *
 * CONSTANTS
 *
 */
var TRACER = '__NR_tracer';

/* Just in case something decides to use the production and
 * debugging tracers at the same time.
 */
var namespace = process.namespaces[TRACER];
if (!namespace) namespace = cls.createNamespace(TRACER);

/**
 * Instead of eating the overhead of creating two separate async listeners
 * to handle CLS and error-tracing, reuse the existing CLS error callback.
 *
 * @param {Agent} agent The current agent instance.
 * @param {Namespace} namespace CLS instance.
 */
function _patchErrorTracerOntoCLS(agent, namespace) {
  var callbacks = namespace && namespace.id && namespace.id.callbacks;
  if (callbacks && callbacks.error) {
    callbacks.error = function (domain, error) {
      var context = namespace.fromException(error);
      var transaction = context && context.transaction;
      agent.errors.add(transaction, error);

      if (domain) namespace.exit(domain);
    };
  }
}

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

  _patchErrorTracerOntoCLS(agent, namespace);
}

Tracer.prototype.getTransaction = function () {
  var transaction = namespace.get('transaction');
  if (transaction && transaction.value && transaction.value.isActive()) {
    return transaction.value;
  }
};

Tracer.prototype.setTransaction = function (transaction) {
  namespace.set('transaction', transaction);
};

Tracer.prototype.getSegment = function () {
  return namespace.get('segment') && namespace.get('segment').value;
};

Tracer.prototype.setSegment = function (segment) {
  namespace.set('segment', segment);
};

Tracer.prototype.addSegment = function (name, recorder) {
  var current              = this.getSegment()
    , segment              = current.add(name, recorder)
    , transactionContainer = namespace.get('transaction')
    , transaction          = transactionContainer.value
    , describer            = transaction.describer
    , segmentContainer     = this.traceSegment(transactionContainer, segment, describer)
    ;

  this.setSegment(segmentContainer);

  return segment;
};


Tracer.prototype.enter = function (call, describer) {
  describer.traceCall('->', call);
};

Tracer.prototype.exit = function (call, describer) {
  describer.traceCall('<-', call);
};

Tracer.prototype.traceTransaction = function (value, describer) {
  this.numTransactions += 1;

  describer.traceCreation('Trace');
  return new Transaction(this.numTransactions, value, describer);
};

Tracer.prototype.traceSegment = function (transaction, value, describer) {
  describer.traceCreation('Segment');
  return transaction.addSegment(value);
};

Tracer.prototype.traceCall = function (segment, value, describer) {
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
  var wrapped = function wrapTransactionInvocation() {
    var describer = self.describer.clone();
    describer.traceWrapping('->', 'T inner');

    // don't nest transactions, reuse existing ones
    var transaction          = self.getTransaction() || new NRTransaction(self.agent)
      , segment              = transaction.getTrace().root
      , proxied              = this
      , args                 = self.slice(arguments)
      , transactionContainer = self.traceTransaction(transaction, describer)
      , segmentContainer     = self.traceSegment(transactionContainer, segment, describer)
      , callContainer        = self.traceCall(segmentContainer, handler, describer)
      ;

    /* NOICE HAX D00D
     *
     * Will leave the end state of the transaction, including the various
     * traces, attached to the transaction.
     */
    transaction.describer = describer;

    self.enter(callContainer, describer);
    var returned;
    namespace.bind(function () {
      self.setTransaction(transactionContainer);
      self.setSegment(segmentContainer);
      returned = namespace.bind(handler).apply(proxied, args);
    }, Object.create(null))();
    self.exit(callContainer, describer);

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
  var wrapped = function wrapSegmentInvocation() {
    // don't implicitly create transactions
    var transactionContainer = namespace.get('transaction');
    if (!transactionContainer) return handler.apply(this, arguments);

    var transaction = transactionContainer.value;
    if (!transaction.isActive()) return handler.apply(this, arguments);

    var describer = transaction.describer;
    describer.traceWrapping('->', 'S inner');

    var segment          = self.getSegment()
      , segmentContainer = self.traceSegment(transactionContainer, segment, describer)
      , callContainer    = self.traceCall(segmentContainer, handler, describer)
      , context          = namespace.createContext()
      ;

    context.segment = segmentContainer;
    context.call = callContainer;

    self.enter(callContainer, describer);
    var returned = namespace.bind(handler, context).apply(this, arguments);
    self.exit(callContainer, describer);

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
  var transaction = this.getTransaction();
  if (!transaction) return handler;

  var describer = transaction.describer;
  describer.traceWrapping('->', 'C outer');

  var segmentContainer = namespace.get('segment')
    , callContainer    = this.traceCall(segmentContainer, handler, describer)
    ;

  var context = namespace.createContext();
  context.segment = segmentContainer;
  context.call = callContainer;

  var self = this;
  var wrapped = namespace.bind(function () {
    describer.traceWrapping('->', 'C inner');

    self.enter(callContainer, describer);
    var returned = handler.apply(this, arguments);
    self.exit(callContainer, describer);

    describer.traceWrapping('<-', 'C inner');
    return returned;
  }, context);

  describer.traceWrapping('<-', 'C outer');
  return wrapped;
};

Tracer.prototype.bindEmitter = NRTracer.prototype.bindEmitter;
Tracer.prototype.setCurrentSegmentType = NRTracer.prototype.setCurrentSegmentType;
Tracer.prototype.isCurrentSegmentType = NRTracer.prototype.isCurrentSegmentType;
Tracer.prototype.slice = NRTracer.prototype.slice;

module.exports = Tracer;
