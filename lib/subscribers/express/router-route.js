/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const ExpressRouteSubscriber = require('./route')

class ExpressRouterRouteSubscriber extends ExpressRouteSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'router' })
    // restore packageName to `express` as this is used for disabling instrumentation
    this.packageName = 'express'
  }
}

module.exports = ExpressRouterRouteSubscriber
