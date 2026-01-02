/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  bunyan: [
    {
      path: './bunyan',
      instrumentations: [
        {
          channelName: 'nr_logger',
          module: { name: 'bunyan', versionRange: '>=1.8.12', filePath: 'lib/bunyan.js' },
          functionQuery: {
            functionName: 'Logger',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './bunyan/emit',
      instrumentations: [
        {
          channelName: 'nr_emit',
          module: { name: 'bunyan', versionRange: '>=1.8.12', filePath: 'lib/bunyan.js' },
          functionQuery: {
            expressionName: '_emit',
            kind: 'Sync'
          }
        }
      ]
    }
  ]
}
