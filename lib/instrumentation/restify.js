/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { MiddlewareMounterSpec, MiddlewareSpec } = require('../shim/specs')

module.exports = function initialize(_agent, restify, _moduleName, shim) {
  shim.setFramework(shim.RESTIFY)
  shim.setRouteParser(function routeParser(_shim, _fn, _fnName, route) {
    return (route && route.path) || route
  })
  let wrappedServerClass = false

  shim.setErrorPredicate(function restifyErrorPredicate(err) {
    return err instanceof Error
  })

  // Restify extends the core http.ServerResponse object when it's loaded,
  // so these methods are separate from core instrumentation.
  const http = require('http')
  const methods = ['send', 'sendRaw', 'redirect']

  shim.wrap(http.ServerResponse.prototype, methods, function wrapMethod(shim, fn) {
    return function wrappedMethod() {
      const segment = shim.getActiveSegment()

      if (segment) {
        // Freezing the name state prevents transaction names from potentially being
        // manipulated by asynchronous response methods executed as part of res.send()
        // but before `next()` is called.
        segment.transaction.nameState.freeze()
      }

      return fn.apply(this, arguments)
    }
  })

  shim.wrapReturn(restify, 'createServer', wrapCreateServer)
  function wrapCreateServer(_shim, _fn, _fnName, server) {
    // If we have not wrapped the server class, now's the time to do that.
    if (server && !wrappedServerClass) {
      wrappedServerClass = true
      wrapServer(Object.getPrototypeOf(server))
    }
  }

  function wrapServer(serverProto) {
    // These are all the methods for mounting routed middleware.
    const routings = ['del', 'get', 'head', 'opts', 'post', 'put', 'patch']
    shim.wrapMiddlewareMounter(
      serverProto,
      routings,
      new MiddlewareMounterSpec({
        route: shim.FIRST,
        endpoint: shim.LAST,
        wrapper: wrapMiddleware
      })
    )

    // These methods do not accept a route, just middleware functions.
    const mounters = ['pre', 'use']
    shim.wrapMiddlewareMounter(
      serverProto,
      mounters,
      new MiddlewareMounterSpec({
        wrapper: wrapMiddleware
      })
    )
  }
}

/**
 * Wraps the middleware handler. In case of `pre` and `use`
 * route is not defined.
 *
 * @param {object} shim instance of shim
 * @param {function} middleware function to record
 * @param {string} _name name of middleware
 * @param {object|null} route name of route
 * @returns {function} wrapped middleware function
 */
function wrapMiddleware(shim, middleware, _name, route) {
  if (shim.isWrapped(middleware)) {
    return middleware
  }
  const spec = new MiddlewareSpec({
    matchArity: true,
    route,
    req: shim.FIRST,
    next: shim.LAST
  })

  const wrappedMw = shim.recordMiddleware(middleware, spec)
  if (shim.isAsyncFunction(middleware)) {
    return async function asyncShim() {
      return wrappedMw.apply(this, arguments)
    }
  }
  return wrappedMw
}
