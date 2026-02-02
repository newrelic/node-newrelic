/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// `Pregel` is the base class of the `CompiledStateGraph` (and others),
// which is the class encapsulating a LangGraph agent.

const graphStream = {
  path: './langgraph/graph-stream.js',
  instrumentations: [
    // CommonJs
    {
      channelName: 'nr_stream',
      module: { name: '@langchain/langgraph', versionRange: '>=1.0.0', filePath: 'dist/pregel/index.cjs' },
      functionQuery: {
        index: 1,
        methodName: 'stream',
        kind: 'Async'
      }
    },
    // ESM
    {
      channelName: 'nr_stream',
      module: { name: '@langchain/langgraph', versionRange: '>=1.0.0', filePath: 'dist/pregel/index.js' },
      functionQuery: {
        index: 1,
        methodName: 'stream',
        kind: 'Async'
      }
    },
  ]
}

module.exports = {
  '@langchain/langgraph': [
    graphStream
  ]
}
