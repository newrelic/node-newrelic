/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base')

class McpClientSubscriber extends Subscriber {
  constructor({ agent, logger, channelName }) {
    super({ agent, logger, packageName: '@modelcontextprotocol/sdk', channelName })
    this.events = ['asyncEnd']
    this.requireActiveTx = true
    this.segmentName = 'Unknown'
  }

  get enabled() {
    return this.config.instrumentation[this.packageName].enabled === true &&
    this.config.ai_monitoring.enabled === true
  }

  handler(ctx) {
    const segment = this.agent.tracer.createSegment({
      name: this.segmentName,
      parent: ctx.segment,
      transaction: ctx.transaction
    })

    const newCtx = ctx.enterSegment({ segment })
    return newCtx
  }
}

module.exports = McpClientSubscriber
