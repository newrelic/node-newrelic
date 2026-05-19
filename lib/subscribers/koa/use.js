/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware')
const MiddlewareWrapper = require('./middleware-wrapper')

class KoaUseSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'koa', channelName: 'nr_use', system: 'Koa', MiddlewareWrapper })
  }

  handler(data) {
    const { arguments: args } = data
    const [mw] = args
    if (mw.router) {
      data.arguments[0] = this.#patchRouterDispatch(mw)
    } else {
      data.arguments[0] = this.wrapper.wrap({ handler: mw, route: '/' })
    }
  }

  #patchRouterDispatch(layer) {
    const wrappedLayer = this.wrapper.wrap({ handler: layer, segmentName: 'Koa/Router: /' })
    const router = layer.router
    const stack = router?.stack ?? []
    for (let i = 0; i < stack.length; i++) {
      const pathLayer = stack[i]
      const pathStack = pathLayer.stack
      const path = pathLayer.path
      for (let j = 0; j < pathStack.length; j++) {
        const isHandler = j === pathStack.length - 1 && i === stack.length - 1
        const routedMiddleware = pathStack[j]
        if (routedMiddleware.param) {
          // old versions of `@koa/router` didn't wrap the `router.param` middleware the same way
          const paramHandlerName = routedMiddleware?._originalFn?.name || routedMiddleware.name
          const segmentName = `${this.wrapper.prefix}/${paramHandlerName}//[param handler :${routedMiddleware.param}]`
          const origMw = routedMiddleware
          const wrappedMw = this.wrapper.wrap({ handler: routedMiddleware, segmentName, route: path })
          Object.defineProperties(wrappedMw, {
            param: { value: origMw.param },
            _originalFn: { value: origMw._originalFn }
          })
          pathStack[j] = wrappedMw
        } else {
          pathStack[j] = this.wrapper.wrap({ handler: routedMiddleware, route: path, isHandler })
        }
      }
    }
    wrappedLayer.router = router
    return wrappedLayer
  }
}

module.exports = KoaUseSubscriber
