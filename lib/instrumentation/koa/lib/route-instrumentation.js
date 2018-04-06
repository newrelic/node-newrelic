'use strict'

const methods = require('methods');

module.exports = function instrumentRoute(shim, route) {
  shim.setFramework(shim.KOA)

  methods.forEach(function (method) {
    shim.wrap(route, method, function wrapRouteGet(shim, originalGet) {
      return function wrappedRouteGet() {
        var middleware = originalGet.apply(route, arguments)
        return shim.recordMiddleware(middleware, {
          type: shim.MIDDLEWARE,
          route: arguments[0],
          next: shim.LAST,
          name: shim.getName(arguments[1]),
          promise: true,
          req: function getReq(shim, fn, fnName, args) {
            var ctx = args[0]
            return ctx && ctx.req
          }
        })
      }
    })
  })
}
