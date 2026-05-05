/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const KoaSubscriber = require('./base')

class KoaRouterRegisterSubscriber extends KoaSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@koa/router', channelName: 'nr_register' })
    this.events = ['end']
  }

  end(data) {
    const layer = data?.result
    if (layer) {
      // Wrap each handler in this route's middleware stack
      // so we can create a segment for each one
      // `route: () => layer.path` — lazily evaluate so router.prefix()
      //    changes are picked up at request time
      // `noAppend: true` — _matchedRoute in create-context.js already
      //    handles path appending
      layer.stack = layer.stack.map((mw) => this.wrapper.wrap(
        { handler: mw, route: () => layer.path, noAppend: true }
      ))
    }
  }
}

module.exports = KoaRouterRegisterSubscriber
