'use strict'

module.exports = function instrumentRouter(shim, Router) {
  shim.setFramework(shim.KOA)

  const proto = Router.prototype

  // app.use(router.routes())
  // .use(router.allowedMethods());

  shim.wrapReturn(proto, 'register', wrapMiddleware)
  shim.wrapReturn(proto, 'allowedMethods', wrapAllowedMethods)
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


  // TODO: eventually, ctx.matched has layers taht havea the path fully merged
  // figure out where/how as instrumenting individually screws up
  // the segment naming for nested routers

  function wrapMiddleware(shim, fn, name, layer) {
    // If Layer returned, middleware registered.
    // If Router returned, register was called on the array of paths and we should bail.
    if (!isLayer(layer)) {
      return
    }

    const spec = {
      route: () => layer.path, // defer retrieval
      type: shim.MIDDLEWARE,
      next: shim.LAST,
      promise: true,
      appendPath: false,
      req: function getReq(shim, fn, fnName, args) {
        return args[0] && args[0].req
      }
    }

    layer.stack = layer.stack.map(function wrapLayerMiddleware(m) {
      // TODO: if we auto instrument the terminal middleware, maybe this
      // code path is no longer necessary as all the middleware will be
      // instrumented by this point
      if (shim.isWrapped(m)) {
        return m
      }


      return shim.recordMiddleware(m, spec)
    })
  }
}

function wrapAllowedMethods(shim, fn, name, allowedMethodsMiddleware) {
  function setRouteHandledOnContextWrapper() {
    const [ctx] = shim.argsToArray.apply(shim, arguments)
    ctx.__NR_matchedSet = true // TODO: rename this to be more of a "handled by router"

    return allowedMethodsMiddleware.apply(this, arguments)
  }

  return shim.recordMiddleware(setRouteHandledOnContextWrapper, {
    type: shim.MIDDLEWARE,
    promise: true,
    appendPath: false,
    next: shim.LAST,
    req: function getReq(shim, fn, fnName, args) {
      return args[0] && args[0].req
    }
  })
}

// TODO: this can prob be simplified ot wrappedreturn
function wrapRoutes(shim, fn) {
  return function wrappedRoutes() {
    const dispatchMiddleware = fn.apply(this, arguments)

    const wrappedDispatch = shim.recordMiddleware(dispatchMiddleware, {
      type: shim.ROUTER,
      promise: true,
      appendPath: false,
      next: shim.LAST,
      req: function getReq(shim, fn, fnName, args) {
        return args[0] && args[0].req
      }
    })

    Object.keys(dispatchMiddleware).forEach(function copyKeys(k) {
      wrappedDispatch[k] = dispatchMiddleware[k]
    })

    return wrappedDispatch
  }
}

function isLayer(obj) {
  return !!(obj.paramNames && obj.path)
}
