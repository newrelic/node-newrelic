/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const ExpressUseSubscriber = require('./use')

class ExpressRouterUseSubscriber extends ExpressUseSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'router' })
  }
}

module.exports = ExpressRouterUseSubscriber
