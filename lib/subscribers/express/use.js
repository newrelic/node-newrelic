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
    let segmentName = null
    // sometimes route is undefined, default to `/` for segmentName only
    const routeName = route || '/'
    // Pre v5 these were marked as `lazyrouter`
    // check for both
    if (fn.lazyrouter || fn.name === 'mounted_app') {
      segmentName = `${this.wrapper.system}/Mounted App: ${routeName}`
    } else if (fn.stack) {
      segmentName = `${this.wrapper.system}/Router: ${routeName}`
      method = 'handle'
    }

    const wrappedFn = this.wrapper.wrap({ handler: fn[method] ?? fn, route, segmentName })
    if (method) {
      data.arguments[fnIndex][method] = wrappedFn
    } else {
      data.arguments[fnIndex] = wrappedFn
    }
  }
}

module.exports = ExpressUseSubscriber
