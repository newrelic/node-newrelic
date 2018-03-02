'use strict'

module.exports = function instrumentRouter(shim, Router, moduleName) {
  shim.setFramework(shim.KOA)

  shim.wrapMiddlewareMounter(Router.prototype, 'param', {
    route: shim.FIRST,
    wrapper: function(shim, middleware, fnName, route) {
      return shim.recordParamware(middleware, {
        name: route,
        next: shim.LAST,
        req: function(shim, fn, fnName, args) {
          return args[1].req
        }
      })
    }
  })

}
