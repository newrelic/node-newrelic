/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Retrieves the IncomingMessage from a Fastify request.  Depending on the
 * context of this function it either exists on `request.raw` or just `request`
 *
 * @param {WebFrameworkShim} shim
 * @param {Function} fn middleware function executing
 * @param {string} fnName name of middleware executing
 * @param {args} args that are passed to middleware
 * @returns {IncomingMessage}
 */
const getRequestFromFastify = (shim, fn, fnName, args) => {
  const [request] = args

  // request is Fastify request
  // object, get IncomingMessage from .raw
  if (request && request.raw) {
    return request.raw
  }

  return request
}

/**
 * Retrieves the params from the Fastify request.
 *
 * @param {WebFrameworkShim} shim
 * @param {Function} fn middleware function executing
 * @param {string} fnName name of middleware executing
 * @param {args} args that are passed to middleware
 * @returns {object} URL params on a Fastify request
 */
const getParamsFromFastifyRequest = (shim, fn, fnName, args) => {
  const [req] = args
  return req && req.params
}

/**
 * Builds the recordMiddleware Spec for the route handler
 *
 * A spec is basically a specification -- or a list
 * of instructions to the recordMiddleware function
 * that provide it with the information it needs to
 * do its job.  You could also think of it as a
 * mini-DSL
 *
 * @param {WebFrameworkShim} shim
 * @param {string} path URL route being executed
 * @returns {object} spec for Fastify route handler
 */
function buildMiddlewareSpecForRouteHandler(shim, path) {
  return {
    /**
     * A function where we can wrap next, reply send, etc. methods
     *
     * This one is tricky.  The `next` function will, same as
     * the `req` function above, receives the fn, fnName,
     * and args from the handler function.  It _also_ receives
     * a `wrap` function.  This wrap function will allow us to
     * to bind a segment for any next function/method, or any
     * method that would finish the request handling (i.e.
     * `reply`, `respond`, etc.)
     *
     * This is far more useful when instrumenting actual middleware vs.
     * instrumenting a simple route handler.  However, if the route
     * handling API uses a method call for responding (vs. returning a value)
     * then this method is required/useful again.
     *
     * The isFinal param determines whether or not a path is appended for
     * this particular piece of middleware. (i.e. if this is the final handler
     * that is actually handling the request, the path is actually left on)
     *
     * @param shim
     * @param fn
     * @param fnName
     * @param args
     * @param bindSegment
     */
    next: function wrapNext(shim, fn, fnName, args, bindSegment) {
      const reply = args[1]
      if (!shim.isFunction(reply)) {
        return
      }
      const isFinal = true
      bindSegment(reply, 'send', isFinal)
    },
    params: getParamsFromFastifyRequest,
    req: getRequestFromFastify,
    route: path
  }
}

/**
 * Spec for all Fastify middleware(excluding route handlers)
 *
 * @param {WebFrameworkShim} shim
 * @param {string} name metric name for middleware being executed
 * @param route
 * @returns {object} spec for Fastify middleware
 */
function buildMiddlewareSpecForMiddlewareFunction(shim, name, route) {
  return {
    name,
    route,
    next: shim.LAST,
    params: getParamsFromFastifyRequest,
    req: getRequestFromFastify,
    type: shim.MIDDLEWARE
  }
}

module.exports = {
  buildMiddlewareSpecForRouteHandler,
  buildMiddlewareSpecForMiddlewareFunction
}
