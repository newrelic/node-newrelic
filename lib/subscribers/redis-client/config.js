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
      module: { name: '@redis/client', versionRange: '>=1', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'sendCommand',
        kind: 'Async'
      }
    }
  ]
}

const commandsExecutor = {
  path: './redis-client/commands-executor',
  instrumentations: [
    {
      channelName: 'nr_commandsExecutor',
      module: { name: '@redis/client', versionRange: '>=1 <4', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'commandsExecutor',
        kind: 'Async'
      }
    }
  ]
}

const clientSelect = {
  path: './redis-client/select',
  instrumentations: [
    {
      channelName: 'nr_select',
      module: { name: '@redis/client', versionRange: '>=1', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'SELECT',
        kind: 'Async'
      }
    }
  ]
}

const clientMulti = {
  path: './redis-client/multi',
  instrumentations: [
    {
      channelName: 'nr_multi',
      module: { name: '@redis/client', versionRange: '>=1', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        className: 'RedisClient',
        methodName: 'MULTI',
        kind: 'Sync'
      }
    }
  ]
}

// Is there a way to only add this config if
// legacy mode is detected? Otherwise,
// orchestrion won't rewrite the other function in client/index.js.
const legacyMode = {
  path: './redis-client/legacy-send-command',
  instrumentations: [
    {
      channelName: 'nr_legacySendCommand',
      module: { name: '@redis/client', versionRange: '>=1 <4', filePath: 'dist/lib/client/index.js' },
      functionQuery: {
        expressionName: '_RedisClient_legacySendCommand',
        kind: 'Sync'
      }
    }
  ]
}

module.exports = {
  '@redis/client': [
    addCommand,
    sendCommand, // redis v5, @redis/client v4
    clientSelect,
    clientMulti,
    commandsExecutor, // redis v4, @redis/client v1
    legacyMode
  ]
}
