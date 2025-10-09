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
  }
}

module.exports = ExpressRouterParamSubscriber
