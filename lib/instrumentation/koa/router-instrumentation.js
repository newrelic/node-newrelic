/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const symbols = require('../../symbols')
const { MiddlewareSpec, MiddlewareMounterSpec } = require('../../shim/specs')

module.exports = function instrumentRouter(shim, Router) {
  shim.setFramework(shim.KOA)

  // @koa/router 15.x exports the Router class as the default export
  const proto = Router.prototype || Router.default?.prototype

  shim.wrapReturn(proto, 'register', wrapMiddleware)
  shim.wrapReturn(proto, 'allowedMethods', wrapAllowedMethods)
  shim.wrapReturn(proto, 'routes', wrapRoutes)
  shim.wrapReturn(proto, 'middleware', wrapRoutes)

  shim.wrapMiddlewareMounter(
    proto,
    'param',
    new MiddlewareMounterSpec({
      route: shim.FIRST,
      wrapper: wrapParamware
    })
  )
}

function wrapParamware(shim, paramware, fnName, route) {
  return shim.recordParamware(
    paramware,
    new MiddlewareSpec({
      name: route,
      next: shim.LAST,
      promise: true,
      appendPath: false,
      req: function getReq(shim, fn, _fnName, args) {
        return args[1] && args[1].req
      }
    })
  )
}

function wrapMiddleware(shim, fn, name, layer) {
  if (!isLayer(layer)) {
    return
  }

  const spec = new MiddlewareSpec({
    route: () => layer.path, // defer retrieval
    next: shim.LAST,
    promise: true,
    appendPath: false,
    req: function getReq(shim, func, fnName, args) {
      return args[0] && args[0].req
    }
  })

  layer.stack = layer.stack.map(function wrapLayerMiddleware(m) {
    // allowedMethods middleware can exist in a stack so we need to
    // protect against re-instrumenting.
    if (shim.isWrapped(m)) {
      return m
    }

    return shim.recordMiddleware(m, spec)
  })
}

function wrapAllowedMethods(shim, fn, name, allowedMethodsMiddleware) {
  const wrapped = shim.wrap(allowedMethodsMiddleware, wrapAllowedMethodsMiddleware)

  return shim.recordMiddleware(
    wrapped,
    new MiddlewareSpec({
      name: allowedMethodsMiddleware.name,
      promise: true,
      appendPath: false,
      next: shim.LAST,
      req: function getReq(shim, func, fnName, args) {
        return args[0] && args[0].req
      }
    })
  )
}

function wrapAllowedMethodsMiddleware(shim, original) {
  return function setRouteHandledOnContextWrapper(...args) {
    const [ctx] = args
    ctx[symbols.koaRouter] = true

    return original.apply(this, arguments)
  }
}

function wrapRoutes(shim, fn, name, dispatchMiddleware) {
  if (shim.isWrapped(dispatchMiddleware)) {
    return dispatchMiddleware
  }
  const wrappedDispatch = shim.recordMiddleware(
    dispatchMiddleware,
    new MiddlewareSpec({
      type: shim.ROUTER,
      promise: true,
      appendPath: false,
      next: shim.LAST,
      req: function getReq(shim, func, fnName, args) {
        return args[0] && args[0].req
      }
    })
  )

  // copy keys from dispatchMiddleware to wrapped version
  return Object.assign(wrappedDispatch, dispatchMiddleware)
}

function isLayer(obj) {
  return !!(obj.paramNames && obj.path)
}
