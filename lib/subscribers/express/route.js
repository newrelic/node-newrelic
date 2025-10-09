/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware')
const methods = ['all', 'delete', 'get', 'head', 'post', 'put', 'patch']

class ExpressRouteSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger, packageName = 'express' }) {
    super({ agent, logger, packageName, channelName: 'nr_route', system: 'Expressjs' })
    this.events = ['end']
  }

  end(data) {
    const route = data?.result
    this.wrapRouteMethods(route)
    const stack = data?.self?.stack
    const layer = stack[stack?.length - 1]
    if (typeof layer?.handle === 'function') {
      data.self.stack[data.self.stack.length - 1].handle = this.wrapHandler({ handler: layer.handle, route: route.path, routePrefix: 'Route Path: ' })
    }
  }

  wrapRouteMethods(route) {
    const self = this
    methods.forEach((method) => {
      const orig = route[method]
      function wrappedRoute(...routeArgs) {
        // express could have multiple routers, wrap them all
        routeArgs.forEach((routeHandler, i) => {
          let routePrefix = null
          let route = null
          if (routeHandler.stack) {
            routePrefix = 'Router: '
            route = '/'
          }
          routeArgs[i] = self.wrapHandler({ handler: routeHandler, routePrefix, route })
        })
        return orig.apply(this, routeArgs)
      }
      Object.defineProperties(wrappedRoute, {
        name: { value: orig.name },
        length: { value: orig.length }
      })
      route[method] = wrappedRoute
    })
  }
}

module.exports = ExpressRouteSubscriber
