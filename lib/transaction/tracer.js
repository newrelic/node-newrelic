'use strict';

var path        = require('path')
  , cls         = require('continuation-local-storage')
  , Transaction = require(path.join(__dirname, '..', 'transaction.js'))
  ;

/*
 *
 * CONSTANTS
 *
 */
var ORIGINAL = '__NR_original'
  , TRACER   = '__NR_tracer'
  , TYPE     = '__NR_segment_type'
  ;

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
      var context     = namespace.fromException(error)
        , transaction = (domain && domain.transaction) ||
                        (context && context.transaction)
        ;

      agent.errors.add(transaction, error);

      if (domain) namespace.exit(domain);
    };
  }
}

/**
 * EXECUTION TRACER
 *
 * One instance of this class exists per agent, with the state
 * representing the current context shared across the agent.
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
 * use transaction/tracer/debug.js. The agent can be configured to
 * run in debugging mode at runtime by setting the configuration
 * variable debug.tracer_tracing.
 */
function Tracer(agent) {
  if (!agent) throw new Error("Must be initialized with an agent.");

  this.agent = agent;

  _patchErrorTracerOntoCLS(agent, namespace);
}

/**
 * Examine shared context to find any current transaction.
 * Filter out inactive transactions.
 *
 * @returns {Transaction} The current transaction.
 */
Tracer.prototype.getTransaction = function () {
  var transaction = namespace.get('transaction');
  if (transaction && transaction.isActive()) return transaction;
};

Tracer.prototype.setTransaction = function (transaction) {
  namespace.set('transaction', transaction);
};

/**
 * Look up the currently active segment.
 *
 * @returns {Segment} Active segment, if set.
 */
Tracer.prototype.getSegment = function () {
  return namespace.get('segment');
};

Tracer.prototype.setSegment = function (segment) {
  namespace.set('segment', segment);
};

/**
 * Create a new trace segment that depends on the current segment on the
 * active transaction trace.
 *
 * @param {string}   name     The metric name for the new segment (can be
 *                            renamed by Segment.prototype.markAsWeb).
 * @param {function} recorder Function to be called when the segment is closed
 *                            and metrics are ready to be recorded.
 *
 * @returns {Segment} The newly-created segment.
 */
Tracer.prototype.addSegment = function (name, recorder) {
  var current = namespace.get('segment');
  var segment = current.add(name, recorder);
  namespace.set('segment', segment);

  return segment;
};

/**
 * Use transactionProxy to wrap a closure that is a top-level handler that is
 * meant to start transactions. This wraps the first half of
 * asynchronous handlers. Use callbackProxy to wrap handler callbacks.
 *
 * @param {Function} handler Generator to be proxied.
 * @returns {Function} Proxy.
 */
Tracer.prototype.transactionProxy = function (handler) {
  // if there's no handler, there's nothing to proxy.
  if (!handler) return;

  var self = this;
  var wrapped = function wrapTransactionInvocation() {
    // don't nest transactions, reuse existing ones
    var transaction = self.getTransaction() || new Transaction(self.agent)
      , proxied     = this
      , args        = self.slice(arguments)
      ;

    var returned;
    namespace.bind(function () {
      self.setTransaction(transaction);
      self.setSegment(transaction.getTrace().root);
      returned = namespace.bind(handler).apply(proxied, args);
    }, Object.create(null))();

    return returned;
  };
  wrapped[ORIGINAL] = handler;

  return wrapped;
};

/**
 * Use segmentProxy to wrap a closure that is a top-level handler that is
 * meant to participate in an existing transaction. Unlike transactionProxy,
 * it will not create new transactions. This is wraps the first half of
 * asynchronous calls. Use callbackProxy to wrap handler callbacks.
 *
 * @param {Function} handler Generator to be proxied.
 * @returns {Function} Proxy.
 */
Tracer.prototype.segmentProxy = function (handler) {
  // if there's no handler, there's nothing to proxy.
  if (!handler) return;

  var self = this;
  var wrapped = function wrapSegmentInvocation() {
    // don't implicitly create transactions
    if (!self.getTransaction()) return handler.apply(this, arguments);

    return namespace.bind(handler, namespace.createContext()).apply(this, arguments);
  };
  wrapped[ORIGINAL] = handler;

  return wrapped;
};

/**
 * Use callbackProxy to wrap a closure that may invoke subsidiary functions that
 * want access to the current transaction. When called, it sets up the correct
 * context before invoking the original function (and tears it down afterwards).
 *
 * Proxying of individual calls is only meant to be done within the scope of
 * an existing transaction.
 *
 * @param {Function} handler Function to be proxied on invocation.
 * @returns {Function} Proxy.
 */
Tracer.prototype.callbackProxy = function (handler) {
  // if there's no handler, there's nothing to proxy.
  if (!handler) return;

  // don't implicitly create transactions
  if (!this.getTransaction()) return handler;

  var wrapped = namespace.bind(handler, namespace.createContext());
  wrapped[ORIGINAL] = handler;

  return wrapped;
};

/**
 * Requests, responses, sockets and streams can be pulled into a request, and
 * the tracer needs to make sure that any event-handling propagates state
 * appropriately. CLS will take care of the necessary monkeypatching (which is
 * kinda gross and slow, but unavoidable without a more general way of bridging
 * synchronous emitters and asynchronous CLS).
 *
 * @param {EventEmitter} emitter The emitter to be put onto the CLS context.
 */
Tracer.prototype.bindEmitter = function (emitter) {
  namespace.bindEmitter(emitter);
};

/**
 * Some instrumented modules make self calls from instrumented functions to
 * instrumented functions.  Because developers can't do anything about these
 * subsidiary calls, and in most cases won't even know they're there, it
 * doesn't make sense to put them on the transaction trace. The instrumentation
 * needs a way to determine whether calls should be ignored or not, and why not
 * use CLS to set the current instrumentation type for the rest of the current
 * tick?
 *
 * @param {object} type An opaque identifier for the current segment type.
 */
Tracer.prototype.setCurrentSegmentType = function (type) {
  // only add a cleaner if there isn't one set already
  if (!namespace.get(TYPE)) process.nextTick(function () {
    namespace.set(TYPE, undefined);
  });
  namespace.set(TYPE, type);
};

/**
 * Determine whether last segment was of the same type. Doing it this way
 * allows synchronous setup calls to alternate between e.g. Redis and MongoDB,
 * without stomping on subsidiary calls.
 *
 * @param {object} type An opaque identifier for the current segment type.
 *
 * @returns {boolean} Whether the segment types match.
 */
Tracer.prototype.isCurrentSegmentType = function (type) {
  return namespace.get(TYPE) === type;
};

Tracer.prototype.slice = function slice(args) {
  /**
   * Usefully nerfed version of slice for use in instrumentation. Way faster
   * than using [].slice.call, and maybe putting it in here (instead of the
   * same module context where it will be used) will make it faster by
   * defeating inlining.
   *
   *   http://jsperf.com/array-slice-call-arguments-2
   *
   *  for untrustworthy benchmark numbers. Only useful for copying whole
   *  arrays, and really only meant to be used with the arguments arraylike.
   *
   *  Also putting this comment inside the function in an effort to defeat
   *  inlining.
   */
  var length = args.length
    , array = []
    , i
    ;

  for (i = 0; i < length; i++) {
    array[i] = args[i];
  }

  return array;
};

module.exports = Tracer;
