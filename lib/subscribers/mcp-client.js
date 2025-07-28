/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('./base')
const { MCP } = require('../metrics/names')

class McpClientSubscriber extends Subscriber {
  constructor(agent, channelName) {
    super(agent, `@modelcontextprotocol/sdk:${channelName}`)
    this.events = ['asyncEnd']
    this.requireActiveTx = true
  }

  handler(ctx, segmentName) {
    const segment = this._agent.tracer.createSegment({
      name: segmentName,
      parent: ctx.segment,
      transaction: ctx.transaction
    })

    const newCtx = ctx.enterSegment({ segment })
    return newCtx
  }
}

class McpClientToolSubscriber extends McpClientSubscriber {
  constructor(agent) {
    super(agent, 'nr_callTool')
  }

  handler(data, ctx) {
    const toolName = data?.arguments?.[0]?.name
    const name = `${MCP.TOOL}/callTool/${toolName}`
    return super.handler(ctx, name)
  }
}

class McpClientResourceSubscriber extends McpClientSubscriber {
  constructor(agent) {
    super(agent, 'nr_readResource')
  }

  handler(data, ctx) {
    const uri = data?.arguments?.[0]?.uri
    const name = `${MCP.RESOURCE}/readResource/${uri}`
    return super.handler(ctx, name)
  }
}

class McpClientPromptSubscriber extends McpClientSubscriber {
  constructor(agent) {
    super(agent, 'nr_getPrompt')
    this.requireActiveTx = true
  }

  handler(data, ctx) {
    const promptName = data?.arguments?.[0]?.name
    const name = `${MCP.PROMPT}/getPrompt/${promptName}`
    return super.handler(ctx, name)
  }
}

const mcpClientToolConfig = {
  package: '@modelcontextprotocol/sdk',
  instrumentations: [
    {
      channelName: 'nr_callTool',
      module: {
        name: '@modelcontextprotocol/sdk',
        versionRange: '>=1.13.0',
        filePath: 'dist/cjs/client/index.js'
      },
      functionQuery: {
        className: 'Client',
        methodName: 'callTool', // must be methodName, not functionName
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_callTool',
      module: {
        name: '@modelcontextprotocol/sdk',
        versionRange: '>=1.13.0',
        filePath: 'dist/esm/client/index.js'
      },
      functionQuery: {
        className: 'Client',
        methodName: 'callTool',
        kind: 'Async'
      }
    },
  ]
}

const mcpClientResourceConfig = {
  package: '@modelcontextprotocol/sdk',
  instrumentations: [
    {
      channelName: 'nr_readResource',
      module: {
        name: '@modelcontextprotocol/sdk',
        versionRange: '>=1.13.0',
        filePath: 'dist/cjs/client/index.js'
      },
      functionQuery: {
        className: 'Client',
        methodName: 'readResource',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_readResource',
      module: {
        name: '@modelcontextprotocol/sdk',
        versionRange: '>=1.13.0',
        filePath: 'dist/esm/client/index.js'
      },
      functionQuery: {
        className: 'Client',
        methodName: 'readResource',
        kind: 'Async'
      }
    }
  ]
}

const mcpClientPromptConfig = {
  package: '@modelcontextprotocol/sdk',
  instrumentations: [
    {
      channelName: 'nr_getPrompt',
      module: {
        name: '@modelcontextprotocol/sdk',
        versionRange: '>=1.13.0',
        filePath: 'dist/cjs/client/index.js'
      },
      functionQuery: {
        className: 'Client',
        methodName: 'getPrompt',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_getPrompt',
      module: {
        name: '@modelcontextprotocol/sdk',
        versionRange: '>=1.13.0',
        filePath: 'dist/esm/client/index.js'
      },
      functionQuery: {
        className: 'Client',
        methodName: 'getPrompt',
        kind: 'Async'
      }
    }
  ]
}

module.exports = {
  mcpClientToolConfig,
  mcpClientResourceConfig,
  mcpClientPromptConfig,
  McpClientToolSubscriber,
  McpClientResourceSubscriber,
  McpClientPromptSubscriber
}
