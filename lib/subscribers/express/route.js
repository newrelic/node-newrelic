/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const methods = ['all', 'delete', 'get', 'head', 'post', 'put', 'patch']
const ExpressSubscriber = require('./base')

class ExpressRouteSubscriber extends ExpressSubscriber {
  constructor({ agent, logger, packageName }) {
    super({ agent, logger, packageName, channelName: 'nr_route' })
    this.events = ['end']
  }

  end(data) {
    const route = data?.result
    this.wrapRouteMethods(route)
    const stack = data?.self?.stack
    const layer = stack[stack?.length - 1]
    if (typeof layer?.handle === 'function') {
      const segmentName = `${this.wrapper.system}/Route Path: ${route.path}`
      data.self.stack[data.self.stack.length - 1].handle = this.wrapper.wrap({ handler: layer.handle, route: route.path, segmentName })
    }
  }

  wrapRouteMethods(route) {
    const self = this
    for (const method of methods) {
      const orig = route[method]
      function wrappedRoute(...routeArgs) {
        // express could have multiple routers, wrap them all
        for (let i = 0; i < routeArgs.length; i++) {
          const routeHandler = routeArgs[i]
          // express supports an array of middlewares as well when defining route
          // wrap each handler and reassign to args
          if (Array.isArray(routeHandler)) {
            for (let j = 0; j < routeHandler.length; j++) {
              const handler = routeHandler[j]
              routeArgs[i][j] = self.wrapper.wrap({ handler })
            }
            continue
          }

          let segmentName = null
          let route = null
          if (routeHandler.stack) {
            route = '/'
            segmentName = `${self.wrapper.system}/Router: ${route}`
          }
          routeArgs[i] = self.wrapper.wrap({ handler: routeHandler, segmentName, route })
        }
        return orig.apply(this, routeArgs)
      }
      Object.defineProperties(wrappedRoute, {
        name: { value: orig.name },
        length: { value: orig.length }
      })
      route[method] = wrappedRoute
    }
  }
}

module.exports = ExpressRouteSubscriber
