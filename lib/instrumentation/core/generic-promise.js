'use strict'

var AGENT_INIT = Symbol('__nr_agent_init')

function _getPromise(shim) {
  var agent = shim.agent
  if (agent.__promiseShim) {
    return agent.__promiseShim
  }

  agent.__promiseShim = {
    Promise: global.Promise
  }

  if (!agent.__promiseShim.Promise) {
    shim.logger.debug('No global Promise found, not instrumenting.')
    agent.__promiseShim.Promise = null
  }

  return agent.__promiseShim
}

function _wrapPromiseExecutor(shim, executor, segment) {
  return function executorWrapper(resolve, reject) {
    shim.runInContext(segment, function() {
      executor(resolve, reject)
    })
  }
}

function _wrapPromiseHandler(shim, handler, segment) {
  if (typeof handler !== 'function') {
    return handler
  }

  return function() {
    var args = arguments
    var self = this
    return shim.runInContext(segment, function() {
      return handler.apply(self, args)
    })
  }
}

function _wrapPromiseMethod(shim, promise, methodName, handlers, segment) {
  var originalMethod = promise[methodName]
  if (typeof originalMethod !== 'function') {
    return originalMethod
  }

  return function wrappedMethod() {
    for (var i = 0; i < handlers.length; ++i) {
      handlers[i] = _wrapPromiseHandler(shim, handlers[i], segment)
    }

    return originalMethod.apply(this, handlers)
  }
}

module.exports = function initialize(shim, promise) {
  var promiseInfo = _getPromise(shim)
  if (!promiseInfo.Promise) {
    return
  }

  var proto = promiseInfo.Promise.prototype
  shim.wrap(proto, 'then', function wrapThen(shim, originalThen) {
    return function wrappedThen() {
      if (this[AGENT_INIT]) {
        return originalThen.apply(this, arguments)
      }

      var segment = shim.tracer.getContext()
      if (!segment) {
        return originalThen.apply(this, arguments)
      }

      var args = new Array(arguments.length)
      for (var i = 0; i < args.length; ++i) {
        args[i] = _wrapPromiseHandler(shim, arguments[i], segment)
      }

      return originalThen.apply(this, args)
    }
  })

  shim.wrap(proto, 'catch', function wrapCatch(shim, originalCatch) {
    return function wrappedCatch() {
      if (this[AGENT_INIT]) {
        return originalCatch.apply(this, arguments)
      }

      var segment = shim.tracer.getContext()
      if (!segment) {
        return originalCatch.apply(this, arguments)
      }

      var handler = arguments[0]
      if (typeof handler === 'function') {
        arguments[0] = _wrapPromiseHandler(shim, handler, segment)
      }

      return originalCatch.apply(this, arguments)
    }
  })

  shim.wrap(proto, 'finally', function wrapFinally(shim, originalFinally) {
    return function wrappedFinally() {
      if (this[AGENT_INIT]) {
        return originalFinally.apply(this, arguments)
      }

      var segment = shim.tracer.getContext()
      if (!segment) {
        return originalFinally.apply(this, arguments)
      }

      var handler = arguments[0]
      if (typeof handler === 'function') {
        arguments[0] = _wrapPromiseHandler(shim, handler, segment)
      }

      return originalFinally.apply(this, arguments)
    }
  })

  var methods = ['allSettled', 'any', 'race']
  for (var i = 0; i < methods.length; ++i) {
    _wrapStaticMethod(shim, promiseInfo.Promise, methods[i])
  }

  _wrapStaticAll(shim, promiseInfo.Promise)
}

function _wrapStaticAll(shim, Promise) {
  shim.wrap(Promise, 'all', function wrapAll(shim, originalAll) {
    return function wrappedAll() {
      var segment = shim.tracer.getContext()
      if (!segment) {
        return originalAll.apply(this, arguments)
      }

      var handler = arguments[0]
      if (Array.isArray(handler)) {
        for (var i = 0; i < handler.length; ++i) {
          if (handler[i] && typeof handler[i].then === 'function') {
            handler[i] = handler[i].then(
              _wrapPromiseHandler(shim, null, segment),
              _wrapPromiseHandler(shim, null, segment)
            )
          }
        }
      }

      return originalAll.apply(this, arguments)
    }
  })
}

function _wrapStaticMethod(shim, Promise, methodName) {
  shim.wrap(Promise, methodName, function wrapMethod(shim, originalMethod) {
    return function wrappedMethod() {
      var segment = shim.tracer.getContext()
      if (!segment) {
        return originalMethod.apply(this, arguments)
      }

      var handler = arguments[0]
      if (Array.isArray(handler)) {
        for (var i = 0; i < handler.length; ++i) {
          if (handler[i] && typeof handler[i].then === 'function') {
            handler[i] = handler[i].then(
              _wrapPromiseHandler(shim, null, segment),
              _wrapPromiseHandler(shim, null, segment)
            )
          }
        }
      }

      return originalMethod.apply(this, arguments)
    }
  })
}
