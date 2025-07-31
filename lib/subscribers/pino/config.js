/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  pino: [{
    path: './pino',
    instrumentations: [
      {
        channelName: 'nr_asJson',
        module: { name: 'pino', versionRange: '>=8.0.0', filePath: 'lib/tools.js' },
        functionQuery: {
          functionName: 'asJson',
          kind: 'Sync'
        }
      }
    ]
  }]
}
