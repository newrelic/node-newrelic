/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware')

class ExpressParamSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger, packageName = 'express' }) {
    super({ agent, logger, packageName, channelName: 'nr_param', system: 'Expressjs' })
  }

  handler(data) {
    const [route, fn] = data?.arguments
    const routeName = `[param handler :${route}]`
    data.arguments[1] = this.wrapper.wrap({ handler: fn, route: routeName, nextIdx: 2 })
  }
}

module.exports = ExpressParamSubscriber
