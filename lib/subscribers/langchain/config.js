/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const similaritySearch = {
  path: './langchain/vectorstore.js',
  instrumentations: [
    // CommonJs
    {
      channelName: 'nr_similaritySearch',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/vectorstores.cjs' },
      functionQuery: {
        methodName: 'similaritySearch',
        kind: 'Async'
      }
    },
    // ESM
    {
      channelName: 'nr_similaritySearch',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/vectorstores.js' },
      functionQuery: {
        methodName: 'similaritySearch',
        kind: 'Async'
      }
    },
  ]
}

const toolCall = {
  path: './langchain/tool.js',
  instrumentations: [
    // CommonJs
    {
      channelName: 'nr_call',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/tools/index.cjs' },
      functionQuery: {
        methodName: 'call',
        kind: 'Async'
      }
    },
    // ESM
    {
      channelName: 'nr_call',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/tools/index.js' },
      functionQuery: {
        methodName: 'call',
        kind: 'Async'
      }
    },
  ]
}

const toolCallbackManager = {
  path: './langchain/tool-callback-manager.js',
  instrumentations: [
    //  CommonJs
    {
      channelName: 'nr_handleToolStart',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/callbacks/manager.cjs' },
      functionQuery: {
        methodName: 'handleToolStart',
        kind: 'Async'
      }
    },
    //  ESM
    {
      channelName: 'nr_handleToolStart',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/callbacks/manager.js' },
      functionQuery: {
        methodName: 'handleToolStart',
        kind: 'Async'
      }
    },
  ]
}

const chainCallbackManager = {
  path: './langchain/chain-callback-manager.js',
  instrumentations: [
    //  CommonJs
    {
      channelName: 'nr_handleChainStart',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/callbacks/manager.cjs' },
      functionQuery: {
        className: 'CallbackManager',
        methodName: 'handleChainStart',
        kind: 'Async'
      }
    },
    //  ESM
    {
      channelName: 'nr_handleChainStart',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/callbacks/manager.js' },
      functionQuery: {
        className: 'CallbackManager',
        methodName: 'handleChainStart',
        kind: 'Async'
      }
    },
  ]
}

const runnableInvoke = {
  path: './langchain/runnable.js',
  instrumentations: [
    // CommonJs
    {
      channelName: 'nr_invoke',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/runnables/base.cjs' },
      functionQuery: {
        className: 'RunnableSequence',
        methodName: 'invoke',
        kind: 'Async'
      }
    },
    // ESM
    {
      channelName: 'nr_invoke',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/runnables/base.js' },
      functionQuery: {
        className: 'RunnableSequence',
        methodName: 'invoke',
        kind: 'Async'
      }
    },
  ]
}

const runnableStream = {
  path: './langchain/runnable-stream.js',
  instrumentations: [
    // CommonJs
    {
      channelName: 'nr_stream',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/runnables/base.cjs' },
      functionQuery: {
        methodName: 'stream',
        kind: 'Async'
      }
    },
    // ESM
    {
      channelName: 'nr_stream',
      module: { name: '@langchain/core', versionRange: '>=0.2.0', filePath: 'dist/runnables/base.js' },
      functionQuery: {
        methodName: 'stream',
        kind: 'Async'
      }
    },
  ]
}

module.exports = {
  '@langchain/core': [
    similaritySearch,
    toolCall,
    toolCallbackManager,
    chainCallbackManager,
    runnableInvoke,
    runnableStream
  ]
}
