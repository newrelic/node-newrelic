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
    this.segmentName = `${MCP.RESOURCE}/readResource/${uri}`
    return super.handler(ctx)
  }
}

module.exports = McpClientResourceSubscriber
