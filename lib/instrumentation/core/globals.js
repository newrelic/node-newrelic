'use strict'

var wrap = require('../../shimmer').wrapMethod

module.exports = initialize

function initialize(agent) {
  var tracer = agent.tracer
  if (process._fatalException) {
    wrap(process, 'process', '_fatalException', function wrapper(original) {
      return function wrapedFatalException(error) {
        agent.tracer.error(error)
        agent.segment = null
        return original.apply(this, arguments)
      }
    })
  } else {
    process.on('uncaughtException', function uncaughtExceptionHandler(error) {
      agent.tracer.error(error)
      agent.segment = null
      if (process._events.uncaughtException.length < 2) return
      throw error
    })
  }


  wrap(global, 'global', 'Promise', wrapPromise)

  function wrapPromise(Promise) {
    wrap(Promise.prototype, 'Promise.prototype', ['then', 'chain'], wrapThen)

    var PromiseMethods = ['accept', 'all', 'defer', 'race', 'reject', 'resolve']

    PromiseMethods.forEach(function copy(key) {
      wrappedPromise[key] = Promise[key]
    })

    return wrappedPromise

    function wrappedPromise(executor) {
      if (!(this instanceof global.Promise)) {
        return Promise(executor)
      }

      var promise = new Promise(wrappedExecutor)
      var context, args
      executor.apply(context, args)

      return promise

      function wrappedExecutor(accept, reject) {
        context = this
        args = [wrappedAccept, wrappedReject]

        // These wrappers create a function that can be passed a function and an argument
        // to call as a continuation from the accept or reject.
        function wrappedAccept(val) {
          if (promise.__nr_wrapper) return accept(val)
          promise.__nr_wrapper = tracer.bindFunction(function fulfilled(ctx, fn, result) {
              return fn.call(ctx, result)
          })
          return accept(val)
        }

        function wrappedReject(val) {
          if (promise.__nr_wrapper) return reject(val)
          promise.__nr_wrapper = tracer.bindFunction(function fulfilled(ctx, fn, result) {
            return fn.call(ctx, result)
          })
          return reject(val)
        }
      }
    }
  }

  function wrapThen(original) {
    return function wrappedThen() {
      var promise = this
      return original.apply(this, [].map.call(arguments, wrapHandler))

      // wrap callbacks (success, error) so that the callbacks will be called as a
      // continuations of the accept or reject call using the __asl__wrapper created above
      function wrapHandler(fn) {
        if (typeof fn !== 'function') return fn
        return function wrappedHandler(val) {
          if (!promise.__nr_wrapper) return fn.call(this, val)
          return promise.__nr_wrapper(this, fn, val)
        }
      }
    }
  }
}
