'use strict'

module.exports = function initialize(shim, Koa) {
  if (!shim || !Koa) {
    shim.logger.debug(
      'Koa instrumentation function called with incorrect arguments, not instrumenting.'
    )
    return
  }

  shim.setFramework(shim.KOA)

  shim.wrapMiddlewareMounter(Koa.prototype, 'use', wrapMiddleware)

  shim.wrap(Koa.prototype, 'emit', function wrapper(shim, original) {
    return function wrappedEmit(evt, err, ctx) {
      if (evt === 'error' && ctx) {
        shim.noticeError(ctx.req, err)
      }
      return original.apply(this, arguments)
    }
  })
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
