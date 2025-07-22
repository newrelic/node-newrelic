/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')

class McpClientSubscriber extends Subscriber {
  constructor(agent) {
    super(agent, '@modelcontextprotocol/sdk:nr_callTool')
    this.events = ['asyncEnd']
  }
}

const mcpClientConfig = {
  package: '@modelcontextprotocol/sdk/client/index.js',
  instrumentations: [
    {
      channelName: 'nr_callTool',
      module: {
        name: '@modelcontextprotocol/sdk',
        versionRange: '^1.13.0',
        filePath: 'client/index.js'
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
