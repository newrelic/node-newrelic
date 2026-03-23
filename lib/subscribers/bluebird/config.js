/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'

module.exports = {
  bluebird: [
    {
      path: './bluebird/instrumentation',
      instrumentations: [{
        channelName: 'nr_then',
        module: { name: 'bluebird', versionRange: '>=2.02', filePath: 'js/release/promise.js' },
        functionQuery: {
          functionName: 'Promise',
          kind: 'Sync'
        }
      }]
    },
  ]
}
