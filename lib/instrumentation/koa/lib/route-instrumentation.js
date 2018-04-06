'use strict'

var methods = require('methods')

module.exports = function instrumentRoute(shim, route) {
  shim.setFramework(shim.KOA)

  methods.forEach(function wrap(method) {
    shim.wrap(route, method, function wrapMethod(shim, methodFn) {
      return function wrappedMethod() {
        var middleware = methodFn.apply(route, arguments)
        return shim.recordMiddleware(middleware, {
          type: shim.MIDDLEWARE,
          route: arguments[0],
          next: shim.LAST,
          name: shim.getName(arguments[1]),
          promise: true,
          req: function getReq(shim, fn, fnName, args) {
            return args[0] && args[0].req
          }
        })
      }
    })
  })
}
