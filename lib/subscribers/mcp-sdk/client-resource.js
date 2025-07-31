/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const McpClientSubscriber = require('./client')
const { MCP } = require('../../metrics/names')

class McpClientResourceSubscriber extends McpClientSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_readResource' })
  }

  handler(data, ctx) {
    const uri = data?.arguments?.[0]?.uri
    const scheme = typeof uri === 'string' ? uri.split('://')[0] : undefined
    this.segmentName = `${MCP.RESOURCE}/readResource/${scheme}`
    return super.handler(ctx)
  }
}

module.exports = McpClientResourceSubscriber
