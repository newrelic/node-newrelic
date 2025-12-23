/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  iovalkey: [{
    path: './iovalkey',
    instrumentations: [
      {
        channelName: 'nr_sendCommand',
        module: { name: 'iovalkey', versionRange: '>=0.1.0', filePath: 'built/Redis.js' },
        functionQuery: {
          className: 'Redis',
          methodName: 'sendCommand',
          kind: 'Sync'
        }
      }
    ]
  }]
}
