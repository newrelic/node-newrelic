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
    this.segmentName = 'Unknown'
  }

  get enabled() {
    return super.enabled && this.config.ai_monitoring.enabled === true
  }

  handler(ctx) {
    return this.createSegment({
      name: this.segmentName,
      ctx
    })
  }
}

module.exports = McpClientSubscriber
