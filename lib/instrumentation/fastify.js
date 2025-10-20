/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')
const {
  buildMiddlewareSpecForRouteHandler
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
 *
 * @param {WebFrameworkShim} shim instance
 * @param {object} fastify Fastify instance
 */
function setupRouteHandler(shim, fastify) {
  fastify.addHook('onRoute', (routeOptions) => {
    if (!routeOptions.handler) {
      return
    }

    /**
     * recordMiddleware handler call
     *
     * The WebFramework shim treats the main route handler like any other
     * i.e. don't be confused by the call to recordMiddleware -- we don't
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
  shim.setFramework(shim.FASTIFY)

  const fastifyVersion = shim.pkgVersion
  const noDiagChannel = semver.lt(fastifyVersion, '3.21.0')
  const isv3Plus = semver.satisfies(fastifyVersion, '>=3.0.0')

  if (!isv3Plus) {
    shim.logger.warn('Fastify version: %s is unsupported, minimum supported version is `3.0.0`', fastifyVersion)
    return
  }

  // In 3.21.0+ fastify emits events via diagnostics channel.
  // we are subscribing to one of those events in `lib/subscribers/fastify/index.js`.
  // This code is for any customers using <3.21.0, which hopefully should be very few.
  // TODO: Remove <3.21.0 support in 14.0.0 of Node.js agent
  if (noDiagChannel) {
    const wrappedExport = shim.wrapExport(fastify, function wrapFastifyModule(shim, fn) {
      return function wrappedFastifyModule() {
        // call original function to get the fastify object (which is singleton-ish)
        const fastifyForWrapping = fn.apply(this, arguments)

        setupRouteHandler(shim, fastifyForWrapping)

        return fastifyForWrapping
      }
    })

    setupExports(fastify, wrappedExport)
  }
}

/**
 * module.exports = fastify
 * module.exports.fastify = fastify
 * module.exports.default = fastify
 *
 * @param {object} original original fastify export
 * @param {object} wrappedExport wrapped fastify export
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
