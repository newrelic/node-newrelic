/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  ioredis: [{
    path: './ioredis',
    instrumentations: [
      {
        channelName: 'nr_sendCommand',
        module: { name: 'ioredis', versionRange: '>=4', filePath: 'built/Redis.js' },
        functionQuery: {
          className: 'Redis',
          methodName: 'sendCommand',
          kind: 'Sync'
        }
      },
      {
        channelName: 'nr_sendCommand',
        module: { name: 'ioredis', versionRange: '>=4', filePath: 'built/redis.js' },
        functionQuery: {
          expressionName: 'sendCommand',
          kind: 'Sync'
        }
      },
      {
        channelName: 'nr_sendCommand',
        module: { name: 'ioredis', versionRange: '>=4', filePath: 'built/redis/index.js' },
        functionQuery: {
          expressionName: 'sendCommand',
          kind: 'Sync'
        }
      }
    ]
  }]
}
