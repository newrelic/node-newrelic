/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSpec = require('./middleware')

/**
 * Called whenever new middleware are mounted using the instrumented framework,
 * this method should pull out a representation of the mounted path.
 *
 * @typedef {Function} RouteParserFunction
 * @param {WebFrameworkShim} shim
 *  The shim in use for this instrumentation.
 * @param {Function} fn
 *  The function which received this route string/RegExp.
 * @param {string} fnName
 *  The name of the function to which this route was given.
 * @param {string|RegExp} route
 *  The route that was given to the function.
 * @returns {string|RegExp} The mount point from the given route.
 */

/**
 * Called for each middleware passed to a mounting method. Should perform the
 * wrapping of the middleware.
 *
 * @typedef {Function} MiddlewareWrapperFunction
 * @param {WebFrameworkShim} shim
 *  The shim used for instrumentation.
 * @param {Function} middleware
 *  The middleware function to wrap.
 * @param {string} fnName
 *  The name of the middleware function.
 * @param {string} [route=null]
 *  The route the middleware is mounted on if one was found.
 * @see WebFrameworkShim#recordMiddleware
 * @see WebFrameworkShim#recordParamware
 */

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} MiddlewareMounterSpecParams
 * @mixes MiddlewareSpecParams
 * @property {RouteParserFunction|string|number|null} [route]
 * @property {MiddlewareWrapperFunction} [wrapper]
 */

class MiddlewareMounterSpec extends MiddlewareSpec {
  /**
   * Indicates which argument specifies the mounting path for the other
   * arguments in a middleware mounting method's arguments list. When set to
   * a function, it is assumed the route was not provided and the indicated
   * argument is a middleware function. If a string is provided, it will be
   * used as the mounting path. If a number is provided, then it indicates
   * the position in the arguments list that represents the route.
   *
   * @type {RouteParserFunction|string|number}
   */
  route

  /**
   * A function to invoke for each middleware function passed to the mounter.
   *
   * @type {MiddlewareWrapperFunction}
   */
  wrapper

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {MiddlewareMounterSpecParams} params
   */
  constructor(params) {
    super(params)

    this.route = params.route ?? null
    this.wrapper = params.wrapper ?? null
  }
}

module.exports = MiddlewareMounterSpec
