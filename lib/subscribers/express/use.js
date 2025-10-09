/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware')

class ExpressUseSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger, packageName = 'express' }) {
    super({ agent, logger, packageName, channelName: 'nr_use', system: 'Expressjs' })
  }

  handler(data) {
    const { arguments: args } = data
    let [route, fn] = args
    let fnIndex = 1
    let method = null
    if (typeof route === 'function') {
      fn = route
      route = null
      fnIndex = 0
    }
    let routePrefix = null
    // Pre v5 these were marked as `lazyrouter`
    // check for both
    if (fn.lazyrouter || fn.name === 'mounted_app') {
      routePrefix = 'Mounted App: '
    } else if (fn.stack) {
      routePrefix = 'Router: '
      method = 'handle'
    }

    const wrappedFn = this.wrapHandler({ handler: fn[method] ?? fn, route, routePrefix })
    if (method) {
      data.arguments[fnIndex][method] = wrappedFn
    } else {
      data.arguments[fnIndex] = wrappedFn
    }
  }
}

module.exports = ExpressUseSubscriber
