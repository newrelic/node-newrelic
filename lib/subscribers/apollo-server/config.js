/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
module.exports = {
  '@apollo/server': [
    {
      path: './apollo-server/request.js',
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
    {
      path: './apollo-server/resolve.js',
      instrumentations: [
        {
          channelName: 'nr_resolve',
          module: { name: '@apollo/server', versionRange: '>=4.0.0', filePath: 'dist/cjs/utils/schemaInstrumentation.js' },
          functionQuery: {
            functionName: 'wrapField',
            kind: 'Sync'
          }
        },
        {
          channelName: 'nr_processRequest',
          module: { name: '@apollo/server', versionRange: '>=4.0.0', filePath: 'dist/esm/utils/schemaInstrumentation.js' },
          functionQuery: {
            functionName: 'wrapField',
            kind: 'Sync'
          }
        }
      ]
    },
  ]
}
