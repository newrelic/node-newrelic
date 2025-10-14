/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const ExpressParamSubscriber = require('./param')

class ExpressRouterParamSubscriber extends ExpressParamSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'router' })
    this.events = ['end']
    // restore packageName to `express` as this is used for disabling instrumentation
    this.packageName = 'express'
  }
}

module.exports = ExpressRouterParamSubscriber
