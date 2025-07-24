/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('./base')
const { MCP } = require('../metrics/names')

/**
 * A base handler function for MCP client operations.
 * @param {string} segmentName - The name of the segment to create.
 * @param {object} agent - The New Relic agent instance.
 * @param {object} ctx - The context object containing the current transaction and segment.
 * @returns {object} The new context with the created segment.
 */
function mcpClientHandler(segmentName, agent, ctx) {
  const segment = agent.tracer.createSegment({
    name: segmentName,
    parent: ctx.segment,
    transaction: ctx.transaction
  })

  const newCtx = ctx.enterSegment({ segment })
  return newCtx
}

class McpClientToolSubscriber extends Subscriber {
  constructor(agent) {
    super(agent, '@modelcontextprotocol/sdk:nr_callTool')
    this.events = ['asyncEnd']
    this.requireActiveTx = true
  }

  handler(data, ctx) {
    const toolName = data?.arguments?.[0]?.name
    const name = `${MCP.TOOL}/callTool/${toolName}`
    return mcpClientHandler(name, this._agent, ctx)
  }
}

class McpClientResourceSubscriber extends Subscriber {
  constructor(agent) {
    super(agent, '@modelcontextprotocol/sdk:nr_readResource')
    this.events = ['asyncEnd']
    this.requireActiveTx = true
  }

  handler(data, ctx) {
    const uri = data?.arguments?.[0]?.uri
    const name = `${MCP.RESOURCE}/readResource/${uri}`
    return mcpClientHandler(name, this._agent, ctx)
  }
}

class McpClientPromptSubscriber extends Subscriber {
  constructor(agent) {
    super(agent, '@modelcontextprotocol/sdk:nr_getPrompt')
    this.events = ['asyncEnd']
    this.requireActiveTx = true
  }

  handler(data, ctx) {
    const promptName = data?.arguments?.[0]?.name
    const name = `${MCP.PROMPT}/getPrompt/${promptName}`
    return mcpClientHandler(name, this._agent, ctx)
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
    // Have to use ESM loader for this to work
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
    // Have to use ESM loader for this to work
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
    // Have to use ESM loader for this to work
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
