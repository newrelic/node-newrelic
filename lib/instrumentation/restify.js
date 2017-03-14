'use strict'


module.exports = function initialize(agent, restify, moduleName, shim) {
  shim.setFramework(shim.RESTIFY)
  shim.setRouteParser(function routeParser(shim, fn, fnName, route) {
    return (route && route.path) || route
  })
  var wrappedServerClass = false

  shim.wrapReturn(restify, 'createServer', wrapCreateServer)
  function wrapCreateServer(shim, fn, fnName, server) {
    // If server creation failed, short circuit our instrumentation here.
    if (!server) {
      return
    }

    // This instrumentation is actually being used to dispatch requests, so
    // register it as such.
    shim.setDispatcher()

    // If we have not wrapped the server class, now's the time to do that.
    if (!wrappedServerClass) {
      wrappedServerClass = true
      wrapServer(Object.getPrototypeOf(server))
    }
  }

  function wrapServer(serverProto) {
    // These are all the methods for mounting routed middleware.
    var methods = ['del', 'get', 'head', 'opts', 'post', 'put', 'patch']
    shim.recordArgsAsMiddleware(serverProto, methods, {
      route: shim.FIRST,
      endpoint: shim.LAST
    })

    // These methods do not accept a route, just middlware functions.
    shim.recordArgsAsMiddleware(serverProto, ['pre', 'use'])

    // This is the first function called within the server class when a new
    // request comes in.
    shim.wrap(serverProto, '_handle', function wrapHandle(shim, fn) {
      return function wrappedHandle(req, res) {
        shim.requestStarted(req, res, {end: ['end', 'send']})
        return fn.apply(this, arguments)
      }
    })
  }
}
