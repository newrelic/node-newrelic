/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const ExpressSubscriber = require('./base')

class ExpressUseSubscriber extends ExpressSubscriber {
  constructor({ agent, logger, packageName }) {
    super({ agent, logger, packageName, channelName: 'nr_use' })
  }

  handler(data) {
    const { arguments: args } = data
    const route = this.routeParser(args[0])
    // sometimes route is undefined, default to `/` for segmentName only
    const routeName = route || '/'
    this.wrapAllMiddleware({
      middlewares: args,
      route,
      routeName
    })
  }

  /**
   * Iterates over all arguments passed to `.use` and wraps any middleware functions
   * They can be:
   *  1. single middleware
   *  2. series of middleware
   *  3. array of middleware
   *  4. combination of any mentioned above
   *
   * @param {object} params to function
   * @param {Array} params.middlewares array of middleware to wrap
   * @param {string|null} params.route route defined in `.use`
   * @param {string} params.routeName route name for segment naming
   */
  wrapAllMiddleware({ middlewares, route, routeName }) {
    for (let i = 0; i < middlewares.length; i++) {
      const middleware = middlewares[i]
      if (Array.isArray(middleware)) {
        this.wrapAllMiddleware({ middlewares: middleware, route })
        continue
      }

      // we only want to wrap functions
      // This is the route definition not middleware
      if (typeof middleware !== 'function') {
        continue
      }

      let segmentName = null
      let method = null
      // Pre v5 these were marked as `lazyrouter`
      // check for both
      if (middleware?.lazyrouter || middleware?.name === 'mounted_app') {
        segmentName = `${this.wrapper.system}/Mounted App: ${routeName}`
      } else if (middleware?.stack) {
        segmentName = `${this.wrapper.system}/Router: ${routeName}`
        method = 'handle'
      }

      const wrappedMw = this.wrapper.wrap({
        handler: middleware[method] ?? middleware,
        route,
        segmentName
      })
      if (method) {
        middlewares[i][method] = wrappedMw
      } else {
        middlewares[i] = wrappedMw
      }
    }
  }

  /**
   * Handles extracting the route from a `.use` method.
   * If a route is not defined it defaults to `null`
   *
   * @param {*} route first arg passed to `.use`
   * @returns {*} route or null
   */
  routeParser(route) {
    if (route instanceof RegExp) {
      return `/${route.source}/`
    } else if (typeof route === 'string') {
      return route
    } else if (Array.isArray(route) && typeof route[0] !== 'function') {
      return route.join(',')
    }
    return null
  }
}

module.exports = ExpressUseSubscriber
