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
        // in v2, `nextTick` is `deprecate(asap, …)`, so not a valid function expression
        module: { name: 'q', versionRange: '>=1.3.0 <2', filePath: 'q.js' },
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
        // in v2, `runAfter` doesn't exist
        module: { name: 'q', versionRange: '>=1.3.0 <2', filePath: 'q.js' },
        functionQuery: {
          expressionName: 'runAfter',
          kind: 'Sync'
        }
      }]
    }
  ]
}
