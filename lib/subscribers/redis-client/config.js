/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const addCommand = {
  path: './redis-client/add-command',
  instrumentations: [{
    channelName: 'nr_addCommand',
    module: { name: '@redis/client', versionRange: '>=1', filePath: 'dist/lib/client/commands-queue.js' },
    functionQuery: {
      className: 'RedisCommandsQueue',
      methodName: 'addCommand',
      kind: 'Async'
    }
  }]
}

const sendCommand = {
  path: './redis-client/send-command',
  instrumentations: [
    {
      channelName: 'nr_sendCommand',
      module: { name: '@redis/client', versionRange: '>=5', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'sendCommand',
        kind: 'Async'
      }
    },
    // for one release `redis@4.6.9` they changed their tsconfig to target node 18+
    // even though at the time they still supported node 14/16
    {
      channelName: 'nr_sendCommand',
      module: { name: '@redis/client', versionRange: '1.5.10', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        privateMethodName: 'sendCommand',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_sendCommand',
      module: { name: '@redis/client', versionRange: '>=1 <1.5.10 || >1.5.10 <5', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        expressionName: '_RedisClient_sendCommand',
        kind: 'Sync'
      }
    }
  ]
}

const clientMulti = {
  path: './redis-client/multi',
  instrumentations: [
    {
      channelName: 'nr_multi',
      module: { name: '@redis/client', versionRange: '>=1.4.2', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'MULTI',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_multi',
      module: { name: '@redis/client', versionRange: '>=1 <1.4.2', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'multi',
        kind: 'Sync'
      }
    }
  ]
}

module.exports = {
  '@redis/client': [
    addCommand,
    sendCommand,
    clientMulti
  ]
}
