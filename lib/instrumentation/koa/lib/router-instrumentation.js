'use strict'

module.exports = function instrumentRouter(shim, Router) {
  shim.setFramework(shim.KOA)

  shim.wrapMiddlewareMounter(Router.prototype, 'param', {
    route: shim.FIRST,
    wrapper: function wrapMiddleware(shim, middleware, fnName, route) {
      return shim.recordParamware(middleware, {
        name: route,
        next: shim.LAST,
        promise: true,
        req: function getReq(shim, fn, _fnName, args) {
          return args[1] && args[1].req
        }
      })
    }
  })
}
