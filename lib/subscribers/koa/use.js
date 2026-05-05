/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const KoaSubscriber = require('./base')
const { koaAllowedMethods } = require('#agentlib/symbols.js')

class KoaUseSubscriber extends KoaSubscriber {
  constructor({ agent, logger, packageName }) {
    super({ agent, logger, packageName, channelName: 'nr_use' })
  }

  handler(data) {
    const { arguments: args } = data
    const [mw] = args
    // Router dispatch functions (returned by routes()/middleware()) get a fixed segment
    // name; plain middleware gets null here so the name is derived from the function name
    const segmentName = mw.router ? 'Koa/Router: /' : null
    // Skip path appending for allowedMethods middleware so 405/501 responses are named
    // by their status code rather than a route path
    const noAppend = mw[koaAllowedMethods] === true
    const routerActive = 'router' in mw
    data.arguments[0] = this.wrapper.wrap({ handler: mw, segmentName, noAppend, routerActive })
  }
}

module.exports = KoaUseSubscriber
