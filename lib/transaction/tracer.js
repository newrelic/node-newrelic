'use strict';

var path        = require('path')
  , cls         = require('continuation-local-storage')
  , dominion    = require(path.join(__dirname, '..', 'dominion.js'))
  , State       = require(path.join(__dirname, 'tracer', 'state.js'))
  , Transaction = require(path.join(__dirname, '..', 'transaction.js'))
  , wrap        = require(path.join(__dirname, '..', 'shimmer.js')).wrapMethod
  ;

/* Just in case something decides to use the production and
 * debugging tracers at the same time.
 */
var namespace = process.namespaces.__NR_tracer;
if (!namespace) namespace = cls.createNamespace("__NR_tracer");

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
function Tracer(agent) {
  if (!agent) throw new Error("Must be initialized with an agent.");

  this.agent = agent;
}

/**
 * Primary interface to the shared state / domains for the instrumentation.
 *
 * @returns {State} The current state of the transaction tracer.
 */
Tracer.prototype.getState = function () {
  return namespace.get('state');
};

/**
 * Examine shared context to find any current transaction.
 * Filter out inactive transactions.
 *
 * @returns {Transaction} The current transaction.
 */
Tracer.prototype.getTransaction = function () {
  var state = namespace.get('state');
  if (state) {
    var transaction = state.getTransaction();
    if (transaction && transaction.isActive()) return transaction;
  }
};

Tracer.prototype.createState = function (transaction, segment, handler) {
  var state = new State(transaction, segment, handler);
  if (dominion.available) dominion.add(this.agent.errors, state);
  return state;
};

/**
 * Everything is connected, zude.
 *
 * @param {State} state     The encapsulated state of the trace.
 * @returns {Object} context The context to which CLS evaluation is bound.
 */
Tracer.prototype.contextify = function (state) {
    var context = namespace.createContext();
    context.state = state;

    return context;
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
      , state       = self.createState(transaction, transaction.getTrace().root, handler)
      , context     = self.contextify(state)
      ;

    return self.monitor(namespace.bind(state.call, context),
                        this, arguments, transaction);
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
    var state = self.getState();
    if (!state) return self.monitor(handler, this, arguments);

    state = self.createState(state.transaction, state.segment, handler);

    return self.monitor(namespace.bind(state.call, self.contextify(state)),
                        this, arguments, state.transaction);
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
  var state = this.getState();
  var self = this;
  if (!state) return function monitored() {
    return self.monitor(handler, this, arguments);
  };

  var context = this.contextify(state);
  var wrapped = function wrapCallbackInvocation() {
    state = self.createState(state.transaction, state.segment, handler);
    return self.monitor(namespace.bind(state.call, context), this,
                        arguments, state.transaction);
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

/**
 * Do violent things to EventEmitters who need to be put on a namespace.
 *
 * FIXME: this should be part of cls-glue, but I need to test the approach first
 */
Tracer.prototype.add = function () {
  // utility functions stolen from cls-glue
  var slice = [].slice;
  function each(obj, callback) {
    var keys = Object.keys(obj);
    for (var i = 0, l = keys.length; i < l; ++i) {
      var key = keys[i];
      callback(key, obj[key]);
    }
  }

  // copies functionality in cls-glue
  function clone() {
    var contexts = {};
    each(process.namespaces, function (name, namespace) {
      contexts[name] = namespace.active;
    });

    return contexts;
  }

  // copies functionality in cls-glue
  function bind(callback, contexts) {
    return function () {
      var namespaces = process.namespaces;
      each(contexts, function (name, context) {
        namespaces[name].enter(context);
      });
      try {
        return callback.apply(this, arguments);
      }
      finally {
        each(contexts, function (name, context) {
          namespaces[name].exit(context);
        });
      }
    };
  }

  // recursively wrapping because wrap is idempotent and streams are weird
  function wrapAndRewrap(on) {
    return function (event, listener) {
      listener.__contexts = clone();

      var returned = on.call(this, event, listener);

      // what in the seven hells is ReadableStream doing here?
      wrap(this, 'eventSource', ['on', 'addListener'], wrapAndRewrap);

      return returned;
    };
  }

  // bind listeners that have contexts just prior to evaluatio
  function setupListeners(handlers) {
    var replacements = [];
    for (var i = 0; i < handlers.length; i++) {
      var handler = handlers[i];
      if (handler.__contexts) {
        replacements.push(bind(handler, handler.__contexts));
      }
      else {
        replacements.push(handler);
      }
    }

    return replacements;
  }

  /* This will modify the state of individual emitters. It attaches the
   * contexts active at the time the listener is attached to the emitter,
   * and then enters all of those contexts when the emit happens. This
   * behavior belongs on the prototype, but for now we're only grabbing
   * requests and responses.
   */
  function violator(source) {
    if (!(source.on && source.addListener && source.emit)) return;

    wrap(source, 'eventSource', ['on', 'addListener'], wrapAndRewrap);

    /* Modifying the internal state of an emitter for the purposes of
     * monkeypatching makes a bunch of dangerous assumptions about
     * what's going on inside the existing emit method. However, better
     * this than trying to completely replace the method, with all its
     * special-case logic for domains.
     */
    wrap(source, 'eventSource', ['emit'], function (emit) {
      return function (event) {
        if (!this._events[event]) return emit.apply(this, arguments);

        var events = this._events[event];
        if (typeof events === 'function' && events.__contexts) {
          this._events[event] = bind(events, events.__contexts);
        }
        else if (events.length) {
          this._events[event] = setupListeners(events);
        }

        var returned = emit.apply(this, arguments);
        // reset listeners to their initial state
        this._events[event] = events;
        return returned;
      };
    });
  }

  slice.call(arguments).forEach(violator);
};

module.exports = Tracer;
