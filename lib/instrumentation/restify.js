'use strict'


module.exports = function initialize(agent, restify, moduleName, shim) {
  shim.setFramework(shim.RESTIFY)
  shim.setRouteParser(function routeParser(shim, fn, fnName, route) {
    return (route && route.path) || route
  })
  var wrappedServerClass = false

  shim.setErrorPredicate(function restifyErrorPredicate(err) {
    return err instanceof Error
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
        return shim.recordMiddleware(
          _wrapRouteHandler(shim, middleware),
          {
            matchArity: true,
            route,
            req: shim.FIRST,
            next: shim.LAST
          }
        )
      }
    })

    // These methods do not accept a route, just middleware functions.
    var mounters = ['pre', 'use']
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

function _wrapRouteHandler(shim, handler) {
  return shim.wrap(handler, function wrapHandler(shim, original) {
    return function wrapped() {
      const req = arguments[0]
      let res = arguments[1]
      if (req && res) {
        _wrapResponse(shim, req, res)
      }
      return original.apply(this, arguments)
    }
  })
}

function _wrapResponse(shim, req, res) {
  const methods = ['send', 'json', 'sendRaw', 'redirect']
  shim.wrap(res, methods, function wrapper(shim, method) {
    return function wrapped() {
      shim.savePossibleTransactionName(req)
      return method.apply(this, arguments)
    }
  })
}
