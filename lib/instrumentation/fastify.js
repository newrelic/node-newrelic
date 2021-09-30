/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')
const {
  buildMiddlewareSpecForRouteHandler,
  buildMiddlewareSpecForMiddlewareFunction
} = require('./fastify/spec-builders')

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
  fastify.addHook('onRoute', (routeOptions) => {
    if (!routeOptions.handler) {
      return
    }
    /**
     * recordMiddleware handler call
     *
     * The WebFramework shim treats the main route handler like any other
     * i.e. dont be confused by the call to recordMiddleware -- we don't
     * have a recordRouteHandler, everything goes through recordMiddleware
     */
    const newRouteHandler = shim.recordMiddleware(
      routeOptions.handler,
      buildMiddlewareSpecForRouteHandler(shim, routeOptions.path)
    )

    routeOptions.handler = newRouteHandler
  })
}

module.exports = function initialize(agent, fastify, moduleName, shim) {
  if (!agent.config.feature_flag.fastify_instrumentation) {
    return
  }

  shim.setFramework(shim.FASTIFY)

  const fastifyVersion = shim.require('./package.json').version
  const isv3Plus = semver.satisfies(fastifyVersion, '>=3.0.0')

  /**
   * Fastify exports a function, so we need to use wrapExport
   */
  const wrappedExport = shim.wrapExport(fastify, function wrapFastifyModule(shim, fn) {
    return function wrappedFastifyModule() {
      // call original function get get fastify object (which is singleton-ish)
      const fastifyForWrapping = fn.apply(this, arguments)

      setupRouteHandler(shim, fastifyForWrapping)

      setupMiddlewareHandlers(shim, fastifyForWrapping, isv3Plus)

      return fastifyForWrapping
    }
  })

  if (isv3Plus) {
    setupExports(fastify, wrappedExport)
  }
}

function setupMiddlewareHandlers(shim, fastify, isv3Plus) {
  const mounterSpec = {
    route: shim.FIRST,
    wrapper: wrapMiddleware
  }

  if (isv3Plus) {
    // Fastify v3+ does not ship with traditional Node.js middleware mounting.
    // This style is accomplished leveraging decorators. Both middie (which was built-in in v2)
    // and fastify-express mount a 'use' function for mounting middleware.
    shim.wrap(fastify, 'decorate', function wrapDecorate(shim, fn) {
      return function wrappedDecorate() {
        const name = arguments[0]
        if (name !== 'use') {
          return fn.apply(this, arguments)
        }

        const args = shim.argsToArray.apply(shim, arguments)
        args[1] = shim.wrapMiddlewareMounter(args[1], mounterSpec)

        return fn.apply(this, args)
      }
    })
  } else {
    shim.wrapMiddlewareMounter(fastify, 'use', mounterSpec)
  }
}

function wrapMiddleware(shim, middleware, name, route) {
  if (shim.isWrapped(middleware)) {
    return middleware
  }

  // prefixing the segment name for middleware execution
  // with the Fastify lifecycle hook
  const segmentName = `onRequest/${name}`
  const spec = buildMiddlewareSpecForMiddlewareFunction(shim, segmentName, route)

  const newMiddlewareFunction = shim.recordMiddleware(middleware, spec)

  return newMiddlewareFunction
}

/**
 * module.exports = fastify
 * module.exports.fastify = fastify
 * module.exports.default = fastify
 */
function setupExports(original, wrappedExport) {
  wrappedExport.fastify = original.fastify

  if (original.fastify) {
    wrappedExport.fastify = wrappedExport
  }

  if (original.default) {
    wrappedExport.default = wrappedExport
  }
}
