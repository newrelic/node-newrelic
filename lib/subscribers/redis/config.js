/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const internalSendCommand = {
  path: './redis/internal-send-command',
  instrumentations: [{
    channelName: 'nr_internalSendCommand',
    module: { name: 'redis', versionRange: '>=3 <4', filePath: 'index.js' },
    functionQuery: {
      // RedisClient.prototype.internal_send_command
      expressionName: 'internal_send_command',
      kind: 'Sync'
    }
  }]
}

module.exports = {
  redis: [
    internalSendCommand
  ]
}
