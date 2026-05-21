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

  /**
   * Patches either every middleware in a layer stack or a middleware defined via `app.use`
   *
   * @param {object} data orchestrion data object
   */
  handler(data) {
    const { arguments: args } = data
    const [mw] = args
    if (mw.router) {
      data.arguments[0] = this.#patchRouterDispatch(mw)
    } else {
      data.arguments[0] = this.wrapper.wrap({ handler: mw, route: '/' })
    }
  }

  /**
   * Patches every middleware on a layer stack.
   * It could either be a RouterMiddleware or ParameterMiddleware
   *
   * @param {Layer} layer instance in koa router
   * @returns {object} wrapped middleware in every layer stack
   */
  #patchRouterDispatch(layer) {
    // every layer requires this segment to wrap it, seems pointless, we can probably remove
    // in a semver major
    const wrappedLayer = this.wrapper.wrap({ handler: layer, segmentName: 'Koa/Router: /' })
    const router = layer.router
    const stack = router?.stack ?? []
    for (let i = 0; i < stack.length; i++) {
      const pathLayer = stack[i]
      const pathStack = pathLayer.stack
      const path = pathLayer.path
      for (let j = 0; j < pathStack.length; j++) {
        const routedMiddleware = pathStack[j]
        if (routedMiddleware.param) {
          pathStack[j] = this.#patchParamMw(routedMiddleware, path)
        } else {
          const isLastInRouter = j === pathStack.length - 1 && i === stack.length - 1
          pathStack[j] = this.wrapper.wrap({ handler: routedMiddleware, route: path, isLastInRouter })
        }
      }
    }
    wrappedLayer.router = router
    return wrappedLayer
  }

  /**
   * Patches parameter middleware defined as `router.param(<param-name>, <mw-fn>)`
   *
   * @param {ParameterMiddleware} paramMiddleware middleware for parameters
   * @param {string} path for a given layer
   * @returns {object} wrapped parameter middleware
   */
  #patchParamMw(paramMiddleware, path) {
    // _originalFn was added in v15.0.0 of `@koa/router`
    const paramHandlerName = paramMiddleware?._originalFn?.name || paramMiddleware.name
    const segmentName = `${this.wrapper.prefix}/${paramHandlerName}//[param handler :${paramMiddleware.param}]`
    const origMw = paramMiddleware
    const wrappedMw = this.wrapper.wrap({ handler: paramMiddleware, segmentName, route: path })

    // re-assign the properties from original layer
    Object.defineProperty(wrappedMw, 'param', { value: origMw.param })

    if (origMw._originalFn) {
      Object.defineProperty(wrappedMw, '_originalFn', { value: origMw._originalFn })
    }
    return wrappedMw
  }
}

module.exports = KoaUseSubscriber
