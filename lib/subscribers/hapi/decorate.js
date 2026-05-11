/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware')

class HapiDecorateSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@hapi/hapi', channelName: 'nr_decorate', system: 'Hapi' })
  }

  handler(data) {
    const { arguments: args } = data
    const [type,, fn] = args

    if (type !== 'handler' || typeof fn !== 'function') {
      return
    }

    const self = this
    function wrappedHandler(route) {
      const handler = fn.apply(this, arguments)
      return self.wrapper.wrap({ handler, route: route?.path })
    }

    if (fn.defaults) {
      wrappedHandler.defaults = fn.defaults
    }

    args[2] = wrappedHandler
  }
}

module.exports = HapiDecorateSubscriber
