/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const addCommand = {
  path: './node-redis-client/add-command',
  instrumentations: [{
    channelName: 'nr_addCommand',
    module: { name: '@node-redis/client', versionRange: '>=1', filePath: 'dist/lib/client/commands-queue.js' },
    functionQuery: {
      className: 'RedisCommandsQueue',
      methodName: 'addCommand',
      kind: 'Async'
    }
  }]
}

const sendCommand = {
  path: './node-redis-client/send-command',
  instrumentations: [
    {
      channelName: 'nr_sendCommand',
      module: { name: '@node-redis/client', versionRange: '>=1.1.0', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'sendCommand',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_sendCommand',
      module: { name: '@node-redis/client', versionRange: '>=1.0.0 <1.1.0', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        expressionName: '_RedisClient_sendCommand',
        kind: 'Sync'
      }
    }
  ]
}

const clientMulti = {
  path: './node-redis-client/multi',
  instrumentations: [
    {
      channelName: 'nr_multi',
      module: { name: '@node-redis/client', versionRange: '>=1', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'multi',
        kind: 'Sync'
      }
    }
  ]
}

module.exports = {
  '@node-redis/client': [
    addCommand,
    sendCommand,
    clientMulti,
  ]
}
