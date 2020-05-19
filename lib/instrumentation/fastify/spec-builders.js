'use strict'

const getRawRequestFromFastifyRequest = (shim, fn, fnName, args) => {
  const request = args[0]
  if (request && request.raw) {
    return request.raw
  }
}

const getParamsFromFastifyRequest = (shim, fn, fnName, args) => {
  const req = args[0]
  return req && req.params
}

/**
 * Builds the recordMiddleware Spec for the route handler
 *
 * A spec is basically a specification -- or a list
 * of insrtuctions to the recordMiddleware function
 * that provide it with the information it needs to
 * do its job.  You could also think of it as a
 * mini-DSL
 */
function buildMiddlewareSpecForRouteHandler(shim, path) {
  return {
    /**
     * The path to use for transaction naming
     */
    route: path,

    /**
     * A function the returns the NodeJS Request Object
     *
     * The job of the `req` callback is to return the current NodeJS
     * IncomingMessage object for this particular handler.  Most NodeJS
     * frameworks will pass the request to each handler -- sometimes (as
     * is the case here) wrapped by another object.
     *
     * @param {any} shim the Webframework Shim
     * @param {any} fn the handler function passed to buildMiddlewareSpec
     * @param {any} fnName the handler function's name
     * @param {any} args the arguments passed to the handler function
     */
    req: getRawRequestFromFastifyRequest,
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
     * this particuar piece of middleware. (i.e. if this is the final handler
     * that is actually handling the request, the path is actually left on)
     */
    next: function wrapNext(shim, fn, fnName, args, bindSegment) {
      const reply = args[1]
      if (!shim.isFunction(reply)) {
        return
      }
      const isFinal = true
      bindSegment(reply, 'send', isFinal)
    },

    /**
     * A function that returns the request paramates
     *
     * @param {any} shim the Webframework Shim
     * @param {any} fn the handler function passed to buildMiddlewareSpec
     * @param {any} fnName the handler function's name
     * @param {any} args the arguments passed to the handler function
     */
    params: getParamsFromFastifyRequest
  }
}

function buildMiddlewareSpecForMiddlewareFunction() {
  return {
    req: getRawRequestFromFastifyRequest,

    next: function wrapNext(shim, fn, fnName, args, bindSegment) {
      const next = args[2]
      if (!shim.isFunction(next)) {
        return
      }
      const isFinal = false
      bindSegment(next, null, isFinal)
    },

    params: getParamsFromFastifyRequest
  }
}

module.exports = {
  buildMiddlewareSpecForRouteHandler,
  buildMiddlewareSpecForMiddlewareFunction
}
