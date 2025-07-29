/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

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
  mcpClientPromptConfig
}
