/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const McpClientSubscriber = require('./client')
const { MCP } = require('../../metrics/names')

class McpClientPromptSubscriber extends McpClientSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_getPrompt' })
  }

  handler(data, ctx) {
    const promptName = data?.arguments?.[0]?.name
    this.segmentName = `${MCP.PROMPT}/getPrompt/${promptName}`
    return super.handler(ctx)
  }
}

module.exports = McpClientPromptSubscriber
