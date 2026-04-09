/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  '@apollo/server': [
    {
      path: './apollo/index.js',
      instrumentations: [
        {
          channelName: 'nr_processRequest',
          module: { name: '@apollo/server', versionRange: '>=4.0.0', filePath: 'dist/cjs/requestPipeline.js' },
          functionQuery: {
            functionName: 'processGraphQLRequest',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_processRequest',
          module: { name: '@apollo/server', versionRange: '>=4.0.0', filePath: 'dist/esm/requestPipeline.js' },
          functionQuery: {
            functionName: 'processGraphQLRequest',
            kind: 'Async'
          }
        }
      ]
    },
  ]
}
