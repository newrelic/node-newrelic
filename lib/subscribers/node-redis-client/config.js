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
      module: { name: '@node-redis/client', versionRange: '>=1', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'sendCommand',
        kind: 'Async'
      }
    }
  ]
}

const commandsExecutor = {
  path: './node-redis-client/commands-executor',
  instrumentations: [
    {
      channelName: 'nr_commandsExecutor',
      module: { name: '@node-redis/client', versionRange: '>=1', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'commandsExecutor',
        kind: 'Async'
      }
    }
  ]
}

const clientSelect = {
  path: './node-redis-client/select',
  instrumentations: [
    {
      channelName: 'nr_select',
      module: { name: '@node-redis/client', versionRange: '>=1', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'SELECT',
        kind: 'Async'
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

const legacyMode = {
  path: './node-redis-client/legacy-send-command',
  instrumentations: [
    {
      channelName: 'nr_legacySendCommand',
      module: { name: '@node-redis/client', versionRange: '>=1', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        expressionName: '_RedisClient_sendCommand',
        kind: 'Sync'
      }
    }
  ]
}

module.exports = {
  '@node-redis/client': [
    addCommand,
    sendCommand,
    clientSelect,
    clientMulti,
    commandsExecutor,
    legacyMode
  ]
}
