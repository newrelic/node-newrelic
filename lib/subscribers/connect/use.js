/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware.js')

module.exports = class CreateServerSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_use',
      packageName: 'connect',
      system: 'Connect'
    })
  }

  handler(data, ctx) {
    const { arguments: args } = data
    const [route, mw] = args
    if (typeof route === 'string') {
      data.arguments[1] = this.wrapper.wrap({ handler: mw, route })
    } else {
      data.arguments[0] = this.wrapper.wrap({ handler: route, route: '/' })
    }
    return ctx
  }
}
