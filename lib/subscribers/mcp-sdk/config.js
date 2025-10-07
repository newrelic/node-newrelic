/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const mcpClientRequestConfig = {
  path: './mcp-sdk/client-request',
  instrumentations: [
    {
      channelName: 'nr_request',
      module: {
        name: '@modelcontextprotocol/sdk',
        versionRange: '>=1.13.0',
        filePath: 'dist/cjs/shared/protocol.js'
      },
      functionQuery: {
        className: 'Protocol',
        methodName: 'request',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_request',
      module: {
        name: '@modelcontextprotocol/sdk',
        versionRange: '>=1.13.0',
        filePath: 'dist/esm/shared/protocol.js'
      },
      functionQuery: {
        className: 'Protocol',
        methodName: 'request',
        kind: 'Async'
      }
    },
  ]
}

module.exports = {
  // only here to properly track when using package
  '@modelcontextprotocol/sdk/client/index.js': [],
  '@modelcontextprotocol/sdk': [
    mcpClientRequestConfig
  ]
}
