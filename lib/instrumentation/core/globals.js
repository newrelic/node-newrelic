'use strict'

var events = require('events')
var wrap = require('../../shimmer').wrapMethod
var util = require('util')

module.exports = initialize

function initialize(agent) {
  // Add handler for uncaught/fatal exceptions to record them.
  var tracer = agent.tracer
  // _fatalException is an undocumented feature of domains, introduced in
  // Node.js v0.8. We use _fatalException when possible because wrapping it will
  // not potentially change the behavior of the server.
  if (process._fatalException) {
    wrap(process, 'process', '_fatalException', function wrapper(original) {
      return function wrappedFatalException(error) {
        // Only record the error if we are not currently within an instrumented
        // domain.
        if (!process.domain) {
          agent.errors.add(null, error)
          agent.tracer.segment = null
        }
        return original.apply(this, arguments)
      }
    })
  } else {
    wrap(
      process,
      'process',
      'emit',
      function wrapEmit(original) {
        return function wrappedEmit(ev, error) {
          if (ev === 'uncaughtException' && error && !process.domain) {
            agent.errors.add(null, error)
            agent.tracer.segment = null
          }

          return original.apply(this, arguments)
        }
      }
    )
  }

  // Add a handler for unhandled promise rejections.
  process.on('unhandledRejection', function __NR_unhandledRejectionHandler(err, promise) {
    // If we're the only listener for this event, report the error.
    if (listenerCount(process, 'unhandledRejection') < 2) {
      var transaction = promise.__NR_segment && promise.__NR_segment.transaction
      agent.errors.add(transaction, err)
    }
  })

  // Native promises use the microtask queue to make all callbacks run
  // asynchronously to avoid zalgo issues. Since the microtask queue is not
  // exposed externally, promises need to be modified in a fairly invasive and
  // complex way.
  //
  // The async boundary in promises that must be instrumented is between the
  // fulfillment of the promise and the execution of any callback that is
  // waiting for that fulfillment to happen. This means that we need to
  // capture the active segment when `accept` or `reject` is called so we can
  // restore it when a callback to `then` or `catch` is executed. There may be
  // multiple callbacks for each fulfilled promise, and more callbacks may be
  // added at any point, even after the promise has been resolved. These
  // callbacks should all be tied to the same segment.
  //
  // This instrumentation does not create new segments, so it uses
  // `tracer.bindFunction` to create a wrapper function that restores the
  // correct segment before calling a callback, The `accept` and `reject`
  // calls can be modified fairly easily to create this wrapper function, but
  // but at the time of `accept` and `reject` all the callbacks that will need
  // to be executed after the promise has been fulfilled may not be defined,
  // since a call to `then`, `chain` or `fetch` can be made even after the
  // promise has been fulfilled. To get around this, the wrapped function
  // that takes a callback, context, and a value as arguments, and calls the,
  // callback with the correct context and value. This wrapped can then be
  // called with each callback once they are defined and ready to be executed.
  //
  // There is another complication with instrumenting Promises. Calls to `then`
  // `chain` and `catch` each create a new Promise that is fulfilled
  // internally in different ways depending on the return value of the
  // callback. When the callback returns a Promise, the new Promise is
  // resolved asynchronously after the returned Promise has been also been
  // resolved. When something other than a Promise is resolved the `accept`
  // call for the new Promise is put in the microtask queue and asynchronously
  // resolved.
  //
  // `then` must be wrapped so that its returned Promise has a wrapper that can
  // be used to invoke further continuations. This wrapper cannot be created
  // until after the callback has run, since the callback may return either a
  // promise or another value. Fortunately we already have a wrapper function
  // around the callback we can use (the wrapper created by `accept` or
  // `reject`).
  //
  // By adding an additional argument to this wrapper, we can pass in the
  // returned Promise so it can have its own wrapper appended. The wrapper
  // function can the call the callback, and take action based on the return
  // value. If a Promise is returned, the new Promise can proxy the returned
  // Promise's wrapper (this wrapper may not exist yet, but will by the time
  // the proxy/wrapper is to be invoked). Otherwise, a new wrapper can be
  // create the same way as in `accept` and `reject`. Since this wrapper is
  // created synchronously within another wrapper, it will properly appear as a
  // continuation from within the callback.

  wrap(global, 'global', 'Promise', wrapPromise)

  function wrapPromise(Promise) {
    // Wrap up #then.
    wrap(Promise.prototype, 'Promise.prototype', ['then', 'chain'], wrapThen)

    // Copy static methods.
    var PromiseMethods = ['accept', 'all', 'defer', 'race', 'reject', 'resolve']
    PromiseMethods.forEach(function copy(key) {
      wrappedPromise[key] = Promise[key]
    })

    // Inherit to pass `instanceof` checks.
    util.inherits(wrappedPromise, Promise)

    // Return our instrumented Promise class.
    return wrappedPromise
    function wrappedPromise(executor) {
      if (!(this instanceof wrappedPromise)) {
        return Promise(executor) // eslint-disable-line new-cap
      }

      if (typeof executor !== 'function') {
        return new Promise(executor)
      }

      var context, args
      var promise = new Promise(wrappedExecutor)

      // must run after promise is defined so that __NR_wrapper can be set
      try {
        executor.apply(context, args)
      } catch (err) {
        args[1](err)
      }

      // the Promise must be created using the "real" Promise constructor
      // (using normal Promise.apply(this) method does not work). But the
      // prototype chain must include the wrappedPromise.prototype,
      // v8's promise implementation uses promise.constructor to create
      // new Promises for calls to `then`, `chain` and `catch` which allows
      // these Promises to also be instrumented
      promise.__proto__ = wrappedPromise.prototype  // eslint-disable-line no-proto

      return promise

      function wrappedExecutor(accept, reject) {
        var segment = tracer.segment
        context = this
        args = [wrappedAccept, wrappedReject]

        // These wrappers create a function that can be passed a function and an argument
        // to call as a continuation from the accept or reject.
        function wrappedAccept(val) {
          if (promise.__NR_wrapper) return accept(val)
          promise.__NR_wrapper = tracer.bindFunction(linkTransaction, segment, true)
          return accept(val)
        }

        function wrappedReject(val) {
          promise.__NR_segment = segment
          if (promise.__NR_wrapper) return reject(val)
          promise.__NR_wrapper = tracer.bindFunction(linkTransaction, segment, true)
          return reject(val)
        }
      }
    }
  }

  /**
   * Brings the transaction through a promise to `then`ed continuations.
   *
   * @return {*} The value returned from the `then`ed function.
   */
  function linkTransaction(ctx, fn, next, data) {
    // next needs to have a wrapper function even if the callback throws.
    try {
      var result = fn.call(ctx, data)
    } finally {
      if (result instanceof Promise) {
        next.__NR_wrapper = function proxyWrapper() {
          return (result.__NR_wrapper || linkTransaction).apply(this, arguments)
        }
      } else {
        next.__NR_wrapper = tracer.bindFunction(linkTransaction)
      }
    }

    return result
  }

  /**
   * Creates a wrapper for `Promise#then` that extends the transaction context.
   *
   * @return {function} A wrapped version of `Promise#then`.
   */
  function wrapThen(original) {
    return function wrappedThen() {
      var promise = this

      var next = original.apply(this, [].map.call(arguments, wrapHandler))

      return next

      // Wrap callbacks (success, error) so that the callbacks will be called as
      // a continuations of the accept or reject call using the __asl__wrapper
      // created above.
      function wrapHandler(fn) {
        if (typeof fn !== 'function') return fn
        return function wrappedHandler(val) {
          if (!promise.__NR_wrapper) return fn.call(this, val)
          return promise.__NR_wrapper(this, fn, next, val)
        }
      }
    }
  }
}

function listenerCount(emitter, evnt) {
  if (events.EventEmitter.listenerCount) {
    return events.EventEmitter.listenerCount(emitter, evnt)
  }
  return emitter.listeners(evnt).length
}
