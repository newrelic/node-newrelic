'use strict'

module.exports = function instrumentRouter(shim, route) {
  shim.setFramework(shim.KOA)

  shim.wrap(route, 'get', function wrapRouteGet(shim, originalGet) {
    return function wrappedRouteGet() {
      var middleware = originalGet.apply(route, arguments)
      return shim.recordMiddleware(middleware, {
        type: shim.MIDDLEWARE,
        route: arguments[0],
        name: shim.getName(arguments[1]),
        promise: true,
        req: function getReq(shim, fn, fnName, args) {
          var ctx = args[0]
          return ctx && ctx.req
        }
      })
    }
  })
}
