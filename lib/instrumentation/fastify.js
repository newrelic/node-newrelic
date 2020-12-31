'use strict'
const semver = require('semver')
const {
  buildMiddlewareSpecForRouteHandler,
  buildMiddlewareSpecForMiddlewareFunction
} = require ('./fastify/spec-builders')
/**
 * Sets up fastify route handler
 *
 * Fastify's onRoute hook will fire whenever
 * a route is registered.  This is the most straight
 * forward way to get at a fastify route definition.
 * Not only are we _not_ relying on private implementations
 * that could change, fastify is pretty good about protecting
 * those private implementations from access, and getting
 * at them would require a lot of gymnastics and hard to
 * maintain code
 */
const setupRouteHandler = (shim, fastify) => {
  fastify.addHook('onRoute', (routeOptions)=>{
    if (!routeOptions.handler) {
      return
    }
    /**
     * recordMiddlware handler call
     *
     * The WebFramework shim treats the main route handler like any other
     * i.e. dont be confused by the call to recordMiddlware -- we don't
     * have a recordRouteHandler, everything goes through recordMiddleware
     */
    const newRouteHandler = shim.recordMiddleware(
      routeOptions.handler,
      buildMiddlewareSpecForRouteHandler(shim, routeOptions.path)
    )

    routeOptions.handler = newRouteHandler
  })
}

const setupMiddlewareHandlers = (shim, fastify) => {
  // Don't wrap use() in fastify v3+
  const fastifyVersion = shim.require('./package.json').version
  if (semver.satisfies(fastifyVersion, '>=3.0.0')) {
    return
  }

  shim.wrap(fastify, 'use', function wrapFastifyUse(shim, fn) {
    return function wrappedFastifyUser() {
      const args = shim.argsToArray.apply(shim, arguments)
      const middlewareFunction = args[0]
      const newMiddlewareFunction = shim.recordMiddleware(
        middlewareFunction,
        buildMiddlewareSpecForMiddlewareFunction(shim)
      )
      // replace original function with our function
      args[0] = newMiddlewareFunction
      // console.log(middlewareFunction.__NR_original)
      return fn.apply(this, args)
    }
  })
}

module.exports = function initialize(agent, fastify, moduleName, shim) {
  if (!agent.config.feature_flag.fastify_instrumentation) {
    return
  }
  shim.setFramework(shim.FASTIFY)
  /**
   * Fastify exports a function, so we need to use wrapExport
   */
  shim.wrapExport(fastify, function wrapFastifyModule(shim, fn) {
    return function wrappedFastifyModule() {
      // normalize arguments
      const args = shim.argsToArray.apply(shim, arguments)

      // call original function get get fastify object (which is singleton-ish)
      const fastifyForWrapping = fn.apply(this, args)

      setupRouteHandler(shim, fastifyForWrapping)

      setupMiddlewareHandlers(shim, fastifyForWrapping)

      return fastifyForWrapping
    }
  })
}
