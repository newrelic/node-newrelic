/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const KoaSubscriber = require('./base')
const { koaAllowedMethods } = require('#agentlib/symbols.js')

class KoaRouterAllowedMethodsSubscriber extends KoaSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@koa/router', channelName: 'nr_allowedMethods' })
    this.events = ['end']
  }

  end(data) {
    const mw = data?.result
    if (typeof mw === 'function') {
      // Tag the returned function so use.js knows to wrap it with noAppend:true
      mw[koaAllowedMethods] = true
    }
  }
}

module.exports = KoaRouterAllowedMethodsSubscriber
