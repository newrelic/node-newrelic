/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MiddlewareSpec, MiddlewareMounterSpec, RenderSpec } = require('../../lib/shim/specs')

/**
 * Express middleware generates traces where middleware are considered siblings
 * (ended on 'next' invocation) and not nested. Middleware are nested below the
 * routers they are mounted to.
 */

module.exports = function initialize(agent, express, moduleName, shim) {
  if (!express || !express.Router) {
    shim.logger.debug('Could not find Express Router, not instrumenting.')
    return false
  }
  shim.setFramework(shim.EXPRESS)

  shim.setErrorPredicate(function expressErrorPredicate(err) {
    return err !== 'route' && err !== 'router'
  })

  shim.wrapMiddlewareMounter(
    express.application,
    'use',
    new MiddlewareMounterSpec({
      route: shim.FIRST,
      wrapper: wrapMiddleware
    })
  )

  wrapExpressRouter(shim, express.Router.use ? express.Router : express.Router.prototype)
  wrapResponse(shim, express.response)
}

function wrapExpressRouter(shim, router) {
  shim.wrapMiddlewareMounter(
    router,
    'use',
    new MiddlewareMounterSpec({
      route: shim.FIRST,
      wrapper: wrapMiddleware
    })
  )

  shim.wrap(router, 'route', function wrapRoute(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }

    return function wrappedRoute() {
      const route = fn.apply(this, arguments)

      // Express should create a new route and layer every time Router#route is
      // called, but just to be on the safe side, make sure we haven't wrapped
      // this already.
      if (!shim.isWrapped(route, 'get')) {
        wrapRouteMethods(shim, route, '')

        const layer = this.stack[this.stack.length - 1]

        // This wraps a 'done' function but not a traditional 'next' function. This allows
        // the route to stay on the stack for middleware nesting after the router.
        // The segment will be automatically ended by the http/https instrumentation.
        shim.recordMiddleware(
          layer,
          'handle',
          new MiddlewareSpec({
            type: shim.ROUTE,
            req: shim.FIRST,
            next: shim.LAST,
            matchArity: true,
            route: route.path
          })
        )
      }
      return route
    }
  })

  shim.wrapMiddlewareMounter(
    router,
    'param',
    new MiddlewareMounterSpec({
      route: shim.FIRST,
      wrapper: function wrapParamware(shim, middleware, fnName, route) {
        return shim.recordParamware(
          middleware,
          new MiddlewareSpec({
            name: route,
            req: shim.FIRST,
            next: shim.THIRD
          })
        )
      }
    })
  )
}

function wrapRouteMethods(shim, route, path) {
  const methods = ['all', 'delete', 'get', 'head', 'opts', 'post', 'put', 'patch']
  shim.wrapMiddlewareMounter(
    route,
    methods,
    new MiddlewareMounterSpec({ route: path, wrapper: wrapMiddleware })
  )
}

function wrapResponse(shim, response) {
  shim.recordRender(
    response,
    'render',
    new RenderSpec({
      view: shim.FIRST,
      callback: function bindCallback(shim, render, name, segment, args) {
        let cbIdx = shim.normalizeIndex(args.length, shim.LAST)
        if (cbIdx === null) {
          return
        }

        const res = this
        let cb = args[cbIdx]
        if (!shim.isFunction(cb)) {
          ++cbIdx
          cb = function defaultRenderCB(err, str) {
            // https://github.com/expressjs/express/blob/4.x/lib/response.js#L961-L962
            if (err) {
              return res.req.next(err)
            }
            res.send(str)
          }
          args.push(cb)
        }
        args[cbIdx] = shim.bindSegment(cb, segment, true)
      }
    })
  )
}

function wrapMiddleware(shim, middleware, name, route) {
  let method = null
  const spec = new MiddlewareSpec({
    route,
    type: shim.MIDDLEWARE,
    matchArity: true,
    req: shim.FIRST
  })

  if (middleware.lazyrouter) {
    method = 'handle'
    spec.type = shim.APPLICATION
  } else if (middleware.stack) {
    method = 'handle'
    spec.type = shim.ROUTER
  } else if (middleware.length === 4) {
    spec.type = shim.ERRORWARE
    spec.req = shim.SECOND
  }

  // Express apps just pass their middleware through to their router. We do not
  // want to count the same middleware twice, so we check if it has already been
  // wrapped. Express also wraps apps mounted on apps, so we need to check if
  // this middleware is that app wrapper.
  //
  // NOTE: Express did not name its app wrapper until 4.6.0.
  if (shim.isWrapped(middleware, method) || name === 'mounted_app') {
    // Don't double-wrap middleware
    return middleware
  }

  return shim.recordMiddleware(middleware, method, spec)
}
