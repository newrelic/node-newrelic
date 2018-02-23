'use strict'

module.exports = function initialize(shim, Koa) {
  if (!shim || !Koa) {
    shim.logger.debug(
      'Koa instrumentation function called with incorrect arguments, not instrumenting.'
    )
    return false
  }

  shim.setFramework(shim.KOA) // TODO

  shim.wrapMiddlewareMounter(Koa.prototype, 'use', wrapMiddleware)
}

function wrapMiddleware(shim, middleware) {
  return shim.recordMiddleware(middleware, {
    type: shim.MIDDLEWARE,
    promise: true,
    next: shim.LAST,
    req: function getReq(shim, fn, fnName, args) {
      var ctx = args[0]
      return ctx && ctx.req
    }
  })
}
