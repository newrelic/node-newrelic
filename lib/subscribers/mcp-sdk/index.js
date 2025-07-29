/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base')
const { MCP } = require('../../metrics/names')

class McpClientSubscriber extends Subscriber {
  constructor(agent, logger, channelName) {
    super({ agent, logger, packageName: '@modelcontextprotocol/sdk', channelName })
    this.events = ['asyncEnd']
    this.requireActiveTx = true
    this.segmentName = ''
  }

  handler(ctx) {
    const segment = this._agent.tracer.createSegment({
      name: this.segmentName,
      parent: ctx.segment,
      transaction: ctx.transaction
    })

    const newCtx = ctx.enterSegment({ segment })
    return newCtx
  }
}

class McpClientToolSubscriber extends McpClientSubscriber {
  constructor(agent, logger) {
    super(agent, logger, 'nr_callTool')
  }

  handler(data, ctx) {
    const toolName = data?.arguments?.[0]?.name
    this.segmentName = `${MCP.TOOL}/callTool/${toolName}`
    return super.handler(ctx)
  }
}

class McpClientResourceSubscriber extends McpClientSubscriber {
  constructor(agent, logger) {
    super(agent, logger, 'nr_readResource')
  }

  handler(data, ctx) {
    const uri = data?.arguments?.[0]?.uri
    this.segmentName = `${MCP.RESOURCE}/readResource/${uri}`
    return super.handler(ctx)
  }
}

class McpClientPromptSubscriber extends McpClientSubscriber {
  constructor(agent, logger) {
    super(agent, 'nr_getPrompt')
    this.requireActiveTx = true
  }

  handler(data, ctx) {
    const promptName = data?.arguments?.[0]?.name
    this.segmentName = `${MCP.PROMPT}/getPrompt/${promptName}`
    return super.handler(ctx)
  }
}

module.exports = {
  McpClientToolSubscriber,
  McpClientResourceSubscriber,
  McpClientPromptSubscriber
}
