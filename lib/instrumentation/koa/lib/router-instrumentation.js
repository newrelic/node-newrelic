/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const symbols = require('./symbols')

module.exports = function instrumentRouter(shim, Router) {
  shim.setFramework(shim.KOA)

  const proto = Router.prototype

  shim.wrapReturn(proto, 'register', wrapMiddleware)
  shim.wrapReturn(proto, 'allowedMethods', wrapAllowedMethods)
  shim.wrapReturn(proto, 'routes', wrapRoutes)
  shim.wrapReturn(proto, 'middleware', wrapRoutes)

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

  function wrapMiddleware(shim, fn, name, layer) {
    if (!isLayer(layer)) {
      return
    }

    const spec = {
      route: () => layer.path, // defer retrieval
      type: shim.MIDDLEWARE,
      next: shim.LAST,
      promise: true,
      appendPath: false,
      req: function getReq(shim, func, fnName, args) {
        return args[0] && args[0].req
      }
    }

    layer.stack = layer.stack.map(function wrapLayerMiddleware(m) {
      // allowedMethods middleware can exist in a stack so we need to
      // protect against re-instrumenting.
      if (shim.isWrapped(m)) {
        return m
      }

      return shim.recordMiddleware(m, spec)
    })
  }
}

function wrapAllowedMethods(shim, fn, name, allowedMethodsMiddleware) {
  const wrapped = shim.wrap(allowedMethodsMiddleware, wrapAllowedMethodsMiddleware)

  return shim.recordMiddleware(wrapped, {
    name: allowedMethodsMiddleware.name,
    type: shim.MIDDLEWARE,
    promise: true,
    appendPath: false,
    next: shim.LAST,
    req: function getReq(shim, func, fnName, args) {
      return args[0] && args[0].req
    }
  })
}

function wrapAllowedMethodsMiddleware(shim, original) {
  return function setRouteHandledOnContextWrapper() {
    const [ctx] = shim.argsToArray.apply(shim, arguments)
    ctx[symbols.koaRouter] = true

    return original.apply(this, arguments)
  }
}

function wrapRoutes(shim, fn, name, dispatchMiddleware) {
  if (shim.isWrapped(dispatchMiddleware)) {
    return dispatchMiddleware
  }
  const wrappedDispatch = shim.recordMiddleware(dispatchMiddleware, {
    type: shim.ROUTER,
    promise: true,
    appendPath: false,
    next: shim.LAST,
    req: function getReq(shim, func, fnName, args) {
      return args[0] && args[0].req
    }
  })

  // copy keys from dispatchMiddleware to wrapped version
  return Object.assign(wrappedDispatch, dispatchMiddleware)
}

function isLayer(obj) {
  return !!(obj.paramNames && obj.path)
}
