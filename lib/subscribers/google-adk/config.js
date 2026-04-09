/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// A single subscriber handles both bundled and unbundled versions of @google/adk.
// Only 0.4.0 ships unbundled separate files; all other versions use a bundled index.js.
const agentRunAsync = {
  path: './google-adk/agent-run-async.js',
  instrumentations: [
    // Most versions bundle everything into dist/cjs/index.js with minified class names.
    // BaseAgent.runAsync is the first `runAsync` method in the bundle (index 0).
    {
      channelName: 'nr_runAsync',
      module: { name: '@google/adk', versionRange: '>=0.1.0 <0.4.0 || >=0.5.0', filePath: 'dist/cjs/index.js' },
      functionQuery: {
        index: 0,
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_runAsync',
      module: { name: '@google/adk', versionRange: '>=0.1.0 <0.4.0 || >=0.5.0', filePath: 'dist/esm/index.js' },
      functionQuery: {
        index: 0,
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    // 0.4.0 uses unbundled separate files with unminified class names.
    {
      channelName: 'nr_runAsync',
      module: { name: '@google/adk', versionRange: '0.4.0', filePath: 'dist/cjs/agents/base_agent.js' },
      functionQuery: {
        className: 'BaseAgent',
        methodName: 'runAsync',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_runAsync',
      module: { name: '@google/adk', versionRange: '0.4.0', filePath: 'dist/esm/agents/base_agent.js' },
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
