'use strict'

module.exports = function instrumentRouter(shim, route) {
  shim.setFramework(shim.KOA)

  shim.wrap(route, 'get', function wrapRouteGet(shim, fn) {
    return function wrappedRouteGet() {
      var middleware = fn.apply(route, arguments)
      middleware.__NR_route = arguments[0]
      return middleware
    }
  })
}
