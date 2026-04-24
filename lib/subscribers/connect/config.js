/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const modName = 'connect'

module.exports = {
  [modName]: [
    {
      path: './connect/use.js',
      instrumentations: [{
        channelName: 'nr_use',
        module: {
          name: modName,
          filePath: 'index.js',
          versionRange: '>=3.0.0'
        },
        functionQuery: {
          expressionName: 'use',
          kind: 'Sync'
        }
      }]
    }
  ]
}
