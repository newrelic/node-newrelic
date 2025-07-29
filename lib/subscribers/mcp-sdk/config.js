/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const mcpClientToolConfig = {
  path: './mcp-sdk/client-tool',
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
  path: './mcp-sdk/client-resource',
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
    },
  ]
}

const mcpClientPromptConfig = {
  path: './mcp-sdk/client-prompt',
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
    },
  ]
}

module.exports = {
  '@modelcontextprotocol/sdk': [mcpClientToolConfig, mcpClientResourceConfig, mcpClientPromptConfig],
}
