/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MiddlewareMounterSpec } = require('../specs')

/**
 * Wraps route mounter and all middleware defined within mounter(arguments to mounter)
 *
 * @private
 * @param {object} spec for the middleware mounter
 * @param {Shim} shim instance of shim
 * @param {Function} fn middleware mounter function
 * @param {string} fnName name of middleware mounter
 * @returns {Function} wrapped function
 */
function wrapMounter(spec, shim, fn, fnName) {
  if (!shim.isFunction(fn)) {
    return fn
  }

  return function wrappedMounter(...args) {
    // Normalize the route index and pull out the route argument if provided.
    let routeIdx = null
    let route = null
    if (shim.isNumber(spec.route)) {
      routeIdx = shim.normalizeIndex(args.length, spec.route)
      route = routeIdx === null ? null : args[routeIdx]
      const isArrayOfFunctions = shim.isArray(route) && shim.isFunction(route[0])
      if (shim.isFunction(route) || isArrayOfFunctions) {
        routeIdx = null
        route = null
      } else if (shim.isArray(route)) {
        route = route.map((routeArg) => shim._routeParser.call(this, shim, fn, fnName, routeArg))
      } else {
        route = shim._routeParser.call(this, shim, fn, fnName, route)
      }
    } else if (spec.route !== null) {
      route = shim._routeParser.call(this, shim, fn, fnName, spec.route)
    }

    wrapAllMiddleware.call(this, { routeIdx, middlewares: args, shim, spec, route })

    return fn.apply(this, args)
  }
}

/**
 * Wraps every middleware defined within middleware route mounter
 *
 * @private
 * @param {object} params object passed to function
 * @param {number} params.routeIdx index of the router arg
 * @param {Array} params.middlewares remaining args(middleware) on route mounter
 * @param {Shim} params.shim instance of shim
 * @param {object} params.spec for the middleware mounter
 * @param {Array | string} params.route route(s)
 */
function wrapAllMiddleware({ routeIdx, middlewares, shim, spec, route }) {
  for (let i = 0; i < middlewares.length; ++i) {
    // If this argument is the route argument skip it.
    if (i === routeIdx) {
      continue
    }

    // Some platforms accept an arbitrarily nested array of middlewares,
    // so if this argument is an array we must recurse into it.
    const middleware = middlewares[i]
    if (middleware instanceof Array) {
      wrapAllMiddleware({ middlewares: middleware, shim, spec, route })
      continue
    }

    middlewares[i] = spec.wrapper.call(this, shim, middleware, shim.getName(middleware), route)
  }
}

/**
 * Wraps a method that is used to add middleware to a server. The middleware
 * can then be recorded as metrics.
 *
 * - `wrapMiddlewareMounter(nodule, properties [, spec])`
 * - `wrapMiddlewareMounter(func [, spec])`
 *
 * @memberof WebFrameworkShim.prototype
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {object} [spec] spec for the middleware mounter
 *  Spec describing the parameters for this middleware mount point.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
 * @see WebFrameworkShim#recordMiddleware
 */
module.exports = function wrapMiddlewareMounter(nodule, properties, spec) {
  if (properties && !this.isString(properties) && !this.isArray(properties)) {
    // wrapMiddlewareMounter(func, spec)
    spec = properties
    properties = null
  }

  const wrapSpec = new MiddlewareMounterSpec({
    matchArity: spec.matchArity,
    wrapper: wrapMounter.bind(null, spec)
  })

  return this.wrap(nodule, properties, wrapSpec)
}
