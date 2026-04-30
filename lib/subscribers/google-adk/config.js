/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const agentRunAsync = {
  path: './google-adk/agent-run-async.js',
  instrumentations: [
    {
      channelName: 'nr_runAsync',
      module: { name: '@google/adk', versionRange: '>=1.1.0', filePath: 'dist/cjs/agents/base_agent.js' },
      functionQuery: {
        className: 'BaseAgent',
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_runAsync',
      module: { name: '@google/adk', versionRange: '>=1.1.0', filePath: 'dist/esm/agents/base_agent.js' },
      functionQuery: {
        className: 'BaseAgent',
        methodName: 'runAsync',
        kind: 'Async'
      }
    }
  ]
}

module.exports = {
  '@google/adk': [
    agentRunAsync
  ]
}
