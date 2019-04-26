'use strict'

module.exports = function instrumentRouter(shim, Router) {
  shim.setFramework(shim.KOA)

  const proto = Router.prototype

  // app.use(router.routes())
  // .use(router.allowedMethods());

  shim.wrapReturn(proto, 'register', wrapMiddleware)
  shim.wrap(proto, 'routes', wrapRoutes)

  shim.wrapMiddlewareMounter(proto, 'param', {
    route: shim.FIRST,
    wrapper: function wrapParamware(shim, paramware, fnName, route) {
      return shim.recordParamware(paramware, {
        name: route,
        next: shim.LAST,
        promise: true,
        appendPath: false,
        req: function getReq(shim, fn, _fnName, args) {
          return args[1] && args[1].req
        }
      })
    }
  })

  // instrument middleware from register() -> one at a time, not full stack at once
  // instrument returned middleware from routes(), no child middleware

  // koa instrumentation should be able to just bail out if already instrumented

  // path, methods, middleware, opts
  // ['blah', 'blee']

  function wrapMiddleware(shim, fn, name, layer) {
    // If Layer returned, middleware registered.
    // If Router returned, register was called on the array of paths and we should bail.
    if (!isLayer(layer)) {
      return
    }

    const spec = {
      route: layer.path,
      type: shim.MIDDLEWARE,
      next: shim.LAST,
      promise: true,
      appendPath: false,
      req: function getReq(shim, fn, fnName, args) {
        return args[0] && args[0].req
      }
    }

    layer.stack = layer.stack.map(function wrapLayerMiddleware(m) {
      // TODO: decide if we need to check to not double instrument
      return shim.recordMiddleware(m, spec)
    })
  }
}

// the outer app.use() instrumentation maybe needing to know we are koa router case

function wrapRoutes(shim, fn) {
  return function wrappedRoutes() {
    const middleware = fn.apply(this, arguments)
    const router = middleware.router

    const wrappedRouter = shim.recordMiddleware(middleware, {
      type: shim.ROUTER,
      promise: true,
      appendPath: false,
      req: function getReq(shim, fn, fnName, args) {
        return args[0] && args[0].req
      }
    })

    Object.keys(router).forEach(function copyKeys(k) {
      wrappedRouter[k] = router[k]
    })

    return middleware
  }
}

function isLayer(obj) {
  return !!(obj.paramNames && obj.path)
}
