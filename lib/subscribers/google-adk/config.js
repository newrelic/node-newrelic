/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const agentRunAsync = {
  path: './google-adk/agent-run-async.js',
  instrumentations: [
    // Google ADK bundles everything into dist/cjs/index.js with minified class names.
    // BaseAgent.runAsync is the first `runAsync` method in the bundle (index 0).
    {
      channelName: 'nr_runAsync',
      module: { name: '@google/adk', versionRange: '>=0.6.0', filePath: 'dist/cjs/index.js' },
      functionQuery: {
        index: 0,
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_runAsync',
      module: { name: '@google/adk', versionRange: '>=0.6.0', filePath: 'dist/esm/index.js' },
      functionQuery: {
        index: 0,
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
