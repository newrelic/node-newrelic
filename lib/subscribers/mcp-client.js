/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')
const { MCP } = require('../metrics/names')
const { record } = require('../metrics/recorders/generic')

class McpClientSubscriber extends Subscriber {
  constructor(agent) {
    super(agent, '@modelcontextprotocol/sdk:nr_callTool')
    this.events = ['asyncEnd']
    this.requireActiveTx = false
  }

  handler(data, ctx) {
    const name = `${MCP.TOOL}/callTool/${data.toolName}`
    const segment = this._agent.tracer.createSegment({
      name,
      parent: ctx.segment,
      recorder: record, // TODO: write recorder for MCP client
      transaction: ctx.transaction
    })

    const newCtx = ctx.enterSegment({ segment })
    return newCtx
  }
}

const mcpClientConfig = {
  package: '@modelcontextprotocol/sdk',
  instrumentations: [
    {
      channelName: 'nr_callTool',
      module: {
        name: '@modelcontextprotocol/sdk',
        versionRange: '^1.13.0',
        // resolvedName: "/Users/achisholm/Desktop/amychisholm03:node-newrelic/test/versioned/modelcontextprotocol-sdk/node_modules/@modelcontextprotocol/sdk/dist/cjs/client/index.js"
        filePath: 'dist/cjs/client/index.js'
      },
      functionQuery: {
        className: 'Client',
        functionName: 'callTool',
        kind: 'Async'
      }
    }
  ]
}

module.exports = { mcpClientConfig, McpClientSubscriber }
