/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')
const { MCP } = require('../metrics/names')
const record = require('../metrics/recorders/generic')

class McpClientSubscriber extends Subscriber {
  constructor(agent) {
    super(agent, '@modelcontextprotocol/sdk:nr_callTool')
    this.events = ['asyncEnd']
    this.requireActiveTx = true
  }

  handler(data, ctx) {
    const toolName = data?.arguments?.[0]?.name
    const name = `${MCP.TOOL}/callTool/${toolName}`
    const segment = this._agent.tracer.createSegment({
      name,
      parent: ctx.segment,
      recorder: record, // TODO: is the generic recorder sufficient?
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
        filePath: 'dist/cjs/client/index.js'
      },
      functionQuery: {
        className: 'Client',
        methodName: 'callTool', // must be methodName, not functionName
        kind: 'Async'
      }
    },
    // TODO: tried this w/ require('@openai/agents'), which then
    //       imports MCP, but it didn't work.
    // {
    //   channelName: 'nr_callTool',
    //   module: {
    //     name: '@modelcontextprotocol/sdk',
    //     versionRange: '^1.13.0',
    //     filePath: 'dist/esm/client/index.js'
    //   },
    //   functionQuery: {
    //     className: 'Client',
    //     methodName: 'callTool',
    //     kind: 'Async'
    //   }
    // },
    // TODO: might have to make seperate subscribers for these
    // {
    //   channelName: 'nr_readResource',
    //   module: {
    //     name: '@modelcontextprotocol/sdk',
    //     versionRange: '^1.13.0',
    //     filePath: 'dist/cjs/client/index.js'
    //   },
    //   functionQuery: {
    //     className: 'Client',
    //     methodName: 'readResource',
    //     kind: 'Async'
    //   }
    // },
    // {
    //   channelName: 'nr_getPrompt',
    //   module: {
    //     name: '@modelcontextprotocol/sdk',
    //     versionRange: '^1.13.0',
    //     filePath: 'dist/cjs/client/index.js'
    //   },
    //   functionQuery: {
    //     className: 'Client',
    //     methodName: 'getPrompt',
    //     kind: 'Async'
    //   }
    // }
  ]
}

module.exports = { mcpClientConfig, McpClientSubscriber }
