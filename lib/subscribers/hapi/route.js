/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware')

class HapiRouteSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@hapi/hapi', channelName: 'nr_route', system: 'Hapi' })
  }

  handler(data) {
    const { arguments: args, self: server } = data
    const prefix = server?.realm?.modifiers?.route?.prefix || ''
    this.#wrapRoute(args[0], prefix)
  }

  #wrapRoute(route, prefix) {
    if (Array.isArray(route)) {
      for (const r of route) {
        this.#wrapRoute(r, prefix)
      }
      return
    }

    const routePath = prefix + (route.path || '')

    if (route.options) {
      if (route.options.pre) {
        route.options.pre = this.#wrapPreHandlers(route.options.pre, routePath)
      }
      if (typeof route.options.handler === 'function') {
        route.options.handler = this.wrapper.wrap({ handler: route.options.handler, route: routePath })
        return
      }
    } else if (route.config) {
      if (route.config.pre) {
        route.config.pre = this.#wrapPreHandlers(route.config.pre, routePath)
      }
      if (typeof route.config.handler === 'function') {
        route.config.handler = this.wrapper.wrap({ handler: route.config.handler, route: routePath })
        return
      }
    }

    if (typeof route.handler === 'function') {
      route.handler = this.wrapper.wrap({ handler: route.handler, route: routePath })
    }
  }

  #wrapPreHandlers(container, routePath) {
    if (Array.isArray(container)) {
      return container.map((item) => this.#wrapPreHandlers(item, routePath))
    }
    if (typeof container === 'function') {
      return this.#wrapPreHandler(container, routePath)
    }
    if (container?.method && typeof container.method === 'function') {
      container.method = this.#wrapPreHandler(container.method, routePath)
    }
    return container
  }

  #wrapPreHandler(handler, routePath) {
    const segmentName = `Hapi pre handler: (${routePath})`
    return this.wrapper.wrap({ handler, segmentName })
  }
}

module.exports = HapiRouteSubscriber
