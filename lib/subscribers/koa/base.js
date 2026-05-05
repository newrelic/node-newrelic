/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware')
const KoaMiddlewareWrapper = require('./middleware-wrapper')

class KoaSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger, packageName = 'koa', channelName }) {
    super({ agent, logger, packageName, channelName, system: 'Koa' })
    this.wrapper = new KoaMiddlewareWrapper({ agent, logger })
  }
}

module.exports = KoaSubscriber
