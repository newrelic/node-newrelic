/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseSubscriber = require('../base')

module.exports = class QNextTick extends BaseSubscriber {
  constructor({ agent, logger, channelName = 'nr_nextTick' }) {
    super({ agent, logger, channelName, packageName: 'q' })
    this.events = ['end']
  }

  handler(data, ctx) {
    const { arguments: args } = data
    data.arguments[0] = this.agent.tracer.bindFunction(args[0], ctx)
    return ctx
  }
}
