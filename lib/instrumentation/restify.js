'use strict'


module.exports = function initialize(agent, restify, moduleName, shim) {
  shim.setFramework(shim.RESTIFY)
  shim.setRouteParser(function routeParser(shim, fn, fnName, route) {
    return (route && route.path) || route
  })
  var wrappedServerClass = false

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
          route: route,
          req: shim.FIRST,
          next: shim.LAST
        })
      }
    })

    // These methods do not accept a route, just middleware functions.
    var mounters = ['pre', 'use']
    shim.wrapMiddlewareMounter(serverProto, mounters, function wrapper(shim, middleware) {
      if (shim.isWrapped(middleware)) {
        return middleware
      }
      return shim.recordMiddleware(middleware, {req: shim.FIRST, next: shim.LAST})
    })
  }
}
