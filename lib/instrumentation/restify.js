'use strict'

module.exports = function initialize(agent, restify, moduleName, shim) {
  shim.setFramework(shim.RESTIFY)
  shim.setRouteParser(function routeParser(shim, fn, fnName, route) {
    return (route && route.path) || route
  })
  let wrappedServerClass = false

  shim.setErrorPredicate(function restifyErrorPredicate(err) {
    return err instanceof Error
  })

  // Restify extends the core http.ServerResponse object when it's loaded,
  // so these methods are separate from core instrumentation.
  const http = require('http')
  const methods = ['send', 'sendRaw', 'redirect']

  shim.wrap(http.ServerResponse.prototype, methods, function wrapMethod(shim, fn) {
    return function wrappedMethod() {
      const segment = shim.getActiveSegment()

      if (segment) {
        // Freezing the name state prevents transaction names from potentially being
        // manipulated by asynchronous response methods executed as part of res.send()
        // but before `next()` is called.
        segment.transaction.nameState.freeze()
      }

      return fn.apply(this, arguments)
    }
  })

  shim.wrapReturn(restify, 'createServer', wrapCreateServer)
  function wrapCreateServer(shim, fn, fnName, server) {
    // If we have not wrapped the server class, now's the time to do that.
    if (server && !wrappedServerClass) {
      wrappedServerClass = true
      wrapServer(Object.getPrototypeOf(server))
    }
  }

  function wrapServer(serverProto) {
    // These are all the methods for mounting routed middleware.
    var routings = ['del', 'get', 'head', 'opts', 'post', 'put', 'patch']
    shim.wrapMiddlewareMounter(serverProto, routings, {
      route: shim.FIRST,
      endpoint: shim.LAST,
      wrapper: function wrapMiddleware(shim, middleware, name, route) {
        if (shim.isWrapped(middleware)) {
          return middleware
        }
        return shim.recordMiddleware(middleware, {
          matchArity: true,
          route,
          req: shim.FIRST,
          next: shim.LAST
        })
      }
    })

    // These methods do not accept a route, just middleware functions.
    const mounters = ['pre', 'use']
    shim.wrapMiddlewareMounter(serverProto, mounters, function wrapper(shim, middleware) {
      if (shim.isWrapped(middleware)) {
        return middleware
      }
      return shim.recordMiddleware(middleware, {
        matchArity: true,
        req: shim.FIRST,
        next: shim.LAST
      })
    })
  }
}
