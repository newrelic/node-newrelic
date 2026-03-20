/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'

module.exports = {
  q: [
    {
      path: './q/next-tick',
      instrumentations: [{
        channelName: 'nr_nextTick',
        module: { name: 'q', versionRange: '>=1.3.0', filePath: 'q.js' },
        functionQuery: {
          expressionName: 'nextTick',
          kind: 'Sync'
        }
      }]
    },
    {
      path: './q/run-after',
      instrumentations: [{
        channelName: 'nr_runAfter',
        module: { name: 'q', versionRange: '>=1.3.0', filePath: 'q.js' },
        functionQuery: {
          expressionName: 'runAfter',
          kind: 'Sync'
        }
      }]
    }
  ]
}
