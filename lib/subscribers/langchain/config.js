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
      module: { name: '@langchain/core', versionRange: '>=1.0.0', filePath: 'dist/vectorstores.cjs' },
      functionQuery: {
        methodName: 'similaritySearch',
        kind: 'Async'
      }
    },
    // ESM
    {
      channelName: 'nr_similaritySearch',
      module: { name: '@langchain/core', versionRange: '>=1.0.0', filePath: 'dist/vectorstores.js' },
      functionQuery: {
        methodName: 'similaritySearch',
        kind: 'Async'
      }
    },
  ]
}

module.exports = {
  '@langchain/core': [similaritySearch]
}
