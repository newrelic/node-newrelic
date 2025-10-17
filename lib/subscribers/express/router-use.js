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

  /**
   * override the `enabled` property as this package is `router`,
   * but it is used in `express` 5.x+
   */
  get enabled() {
    return this.config.instrumentation.express.enabled === true
  }
}

module.exports = ExpressRouterUseSubscriber
