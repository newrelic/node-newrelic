/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const KoaSubscriber = require('./base')
const KoaMiddlewareWrapper = require('./middleware-wrapper')

class KoaRouterParamSubscriber extends KoaSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@koa/router', channelName: 'nr_param' })
    this.wrapper = new KoaMiddlewareWrapper({ agent, logger, system: 'Koa', ctxArgIndex: 1 })
  }

  handler(data) {
    const [paramName, fn] = data.arguments
    const routeName = `/[param handler :${paramName}]`
    data.arguments[1] = this.wrapper.wrap({ handler: fn, route: routeName, nextIdx: 2, noAppend: true })
  }
}

module.exports = KoaRouterParamSubscriber
