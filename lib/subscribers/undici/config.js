/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  undici: [
    {
      path: './undici',
      instrumentations: []
    },
    {
      path: './undici/build-connector',
      instrumentations: [
        {
          channelName: 'nr_buildConnector',
          module: { name: 'undici', versionRange: '>=5.0.0', filePath: 'lib/core/connect.js' },
          functionQuery: {
            functionName: 'buildConnector',
            kind: 'Sync'
          }
        }
      ]
    }
  ]
}
