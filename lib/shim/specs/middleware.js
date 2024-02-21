/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { ARG_INDEXES } = require('./constants')
const RecorderSpec = require('./recorder')

/**
 * Extracts the request object from the arguments to the middleware function.
 *
 * @typedef {function} RouteRequestFunction
 * @param {WebFrameworkShim} shim The shim used for instrumentation.
 * @param {Function} fn The middleware function.
 * @param {string} fnName The name of the middleware function.
 * @param {Array} args The arguments to the middleware function.
 * @returns {object} The request object.
 */

/**
 * Used to wrap functions that users can call to continue to the next
 * middleware.
 *
 * @typedef {function} RouteNextFunction
 * @param {WebFrameworkShim} shim The shim used for instrumentation.
 * @param {Function} fn The middleware function.
 * @param {string} fnName The name of the middleware function.
 * @param {Array} args The arguments to the middleware function.
 * @returns {object} The request object.
 */

/**
 * Extracts the route parameters from the arguments to the middleware function.
 *
 * @typedef {function} RouteParameterFunction
 * @param {WebFrameworkShim} shim The shim used for instrumentation.
 * @param {Function} fn The middleware function.
 * @param {string} fnName The name of the middleware function.
 * @param {Array} args The arguments to the middleware function.
 * @returns {object} A map of route parameter names to values.
 */

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} MiddlewareSpecParams
 * @mixes RecorderSpecParams
 * @property {boolean} [appendPath]
 * @property {number|RouteNextFunction} [next]
 * @property {RouteParameterFunction|null} [params]
 * @property {number|RouteRequestFunction} [req]
 * @property {number} [res]
 * @property {number|string|null} [route]
 * @property {string} [type]
 */

/**
 * Spec that describes how to instrument a framework middleware function, e.g.
 * an `express` middleware.
 */
class MiddlewareSpec extends RecorderSpec {
  /**
   * Indicates if the route path for the middleware should be appended to
   * the transaction name or not.
   *
   * @type {boolean}
   */
  appendPath

  /**
   * When a number, indicates the argument position of the "next" callback in
   * the original middleware function's parameters list. Otherwise, it's a
   * function that will be invoked with the arguments of the middleware and
   * another function for wrapping calls that represent continuation from the
   * instrumented middleware.
   *
   * @type {number|RouteNextFunction}
   */
  next

  /**
   * A function to extract the route parameters from the instrumented
   * middleware's arguments list.
   *
   * @type {RouteParameterFunction}
   */
  params

  /**
   * When a number, indicates the argument position of the request object in
   * the middleware function's arguments list. Otherwise, it's a function that
   * extracts the request object from the middleware arguments.
   *
   * @type {number|RouteRequestFunction}
   */
  req

  /**
   * Indicates the argument position of the response object in the middleware
   * function's arguments list.
   *
   * @type {number}
   */
  res

  /**
   * When a number, indicates the argument position of the route string in the
   * middleware function's arguments list. Otherwise, it is a string that
   * represents the route path.
   *
   * @type {number|string|null}
   */
  route

  /**
   * Indicates the type of middleware that is being instrumented.
   *
   * @see {MiddlewareTypeNames}
   * @type {string}
   */
  type

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {MiddlewareSpecParams} constructorParams
   */
  constructor(constructorParams) {
    super(constructorParams)

    this.appendPath = constructorParams.appendPath ?? true
    this.next = constructorParams.next ?? ARG_INDEXES.THIRD
    this.params =
      constructorParams.params ??
      function getParamsFromReq(...args) {
        // At some point in the future, after more inspection and wrapping
        // has been done, this function will be invoked with a potential
        // `req` object as the last parameters.
        // See https://github.com/newrelic/node-newrelic/blob/f33c0cc/lib/shim/webframework-shim/middleware.js#L69
        const req = args.at(-1)
        return req && req.params
      }
    this.req = constructorParams.req ?? ARG_INDEXES.FIRST
    this.res = constructorParams.res ?? ARG_INDEXES.SECOND
    this.route = constructorParams.route ?? null
    this.type = constructorParams.type ?? 'MIDDLEWARE'
  }
}

module.exports = MiddlewareSpec
