/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const McpClientSubscriber = require('./client')
const { MCP } = require('../../metrics/names')

class McpClientToolSubscriber extends McpClientSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_callTool' })
  }

  handler(data, ctx) {
    const toolName = data?.arguments?.[0]?.name
    this.segmentName = `${MCP.TOOL}/callTool/${toolName}`
    return super.handler(ctx)
  }
}

module.exports = McpClientToolSubscriber
