'use strict'


module.exports = function initialize(shim, Koa) {
  if (!shim || !Koa || Object.keys(Koa.prototype).length > 1) {
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
  shim.wrapReturn(Koa.prototype, 'createContext', wrapCreateContext)
  function wrapCreateContext(shim, fn, fnName, context) {
    context.__NR_body = context.response.body
    Object.defineProperty(context.response, '_body', {
      get: function getBody() {
        return this.__NR_body
      },
      set: function setBody(val) {
        shim.savePossibleTransactionName(this.req)
        this.__NR_body = val
      }
    })
  }
}

function wrapMiddleware(shim, middleware) {
  var router = middleware.router
  if (router && router.stack && router.stack.length) {
    var stack = router.stack
    for (var i = 0; i < stack.length; ++i) {
      var layer = stack[i]
      var spec = {
        route: layer.path,
        type: shim.MIDDLEWARE,
        next: shim.LAST,
        promise: true,
        req: function getReq(shim, fn, fnName, args) {
          return args[0] && args[0].req
        }
      }
      layer.stack = layer.stack.map(function wrapLayerMiddleware(m) {
        return shim.recordMiddleware(m, spec)
      })
    }
    var wrappedRouter = shim.recordMiddleware(middleware, {
      type: shim.ROUTER,
      promise: true,
      req: function getReq(shim, fn, fnName, args) {
        var ctx = args[0]
        return ctx && ctx.req
      }
    })
    Object.keys(router).forEach(function copyKeys(k) {
      wrappedRouter[k] = router[k]
    })
    return wrappedRouter
  }

  // skip middleware that is already wrapped
  if (shim.isWrapped(middleware)) {
    return middleware
  }

  return shim.recordMiddleware(middleware, {
    type: shim.MIDDLEWARE,
    promise: true,
    req: function getReq(shim, fn, fnName, args) {
      var ctx = args[0]
      return ctx && ctx.req
    }
  })
}
