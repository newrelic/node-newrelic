'use strict';

var path     = require('path')
  , dominion = require(path.join(__dirname, '..', 'dominion'))
  , State    = require(path.join(__dirname, 'tracer', 'state'))
  ;

/*
 *
 * CONSTANTS
 *
 */

var ORIGINAL = '__NR_original';

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
function Tracer(agent, context) {
  if (!agent) throw new Error("Must be initialized with an agent.");
  if (!context) throw new Error("Must include shared context.");

  this.agent   = agent;
  this.context = context;
}

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
    var transaction = self.agent.createTransaction();

    var state = new State(transaction, transaction.getTrace().root, handler);
    if (dominion.available) dominion.add(self.agent, state);
    self.context.enter(state);
    var returned = self.monitor(handler, this, arguments, transaction);
    self.context.exit(state);

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
    var state = self.context.state;
    if (!state) return self.monitor(handler, this, arguments);

    state = new State(state.transaction, state.segment, handler);
    self.context.enter(state);
    var returned = self.monitor(handler, this, arguments, state.transaction);
    self.context.exit(state);

    return returned;
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
  var state = this.context.state;
  if (!state) return handler;

  var self = this;
  var wrapped = function wrapCallbackInvocation() {
    state = new State(state.transaction, state.segment, handler);
    self.context.enter(state);
    var returned = self.monitor(handler, this, arguments, state.transaction);
    self.context.exit(state);

    return returned;
  };
  wrapped[ORIGINAL] = handler;

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
