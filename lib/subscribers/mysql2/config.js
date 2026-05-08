/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const connectionQuery = {
  path: './mysql2/connection-query.js',
  instrumentations: [
    {
      channelName: 'nr_connectionQuery',
      module: { name: 'mysql2', versionRange: '>=3.0.0 <3.11.5', filePath: 'lib/connection.js' },
      functionQuery: {
        className: 'Connection',
        methodName: 'query',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_connectionQuery',
      module: { name: 'mysql2', versionRange: '>=3.11.5', filePath: 'lib/base/connection.js' },
      functionQuery: {
        className: 'BaseConnection',
        methodName: 'query',
        kind: 'Sync'
      }
    }
  ]
}

const connectionExecute = {
  path: './mysql2/connection-execute.js',
  instrumentations: [
    {
      channelName: 'nr_connectionExecute',
      module: { name: 'mysql2', versionRange: '>=3.0.0 <3.11.5', filePath: 'lib/connection.js' },
      functionQuery: {
        className: 'Connection',
        methodName: 'execute',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_connectionExecute',
      module: { name: 'mysql2', versionRange: '>=3.11.5', filePath: 'lib/base/connection.js' },
      functionQuery: {
        className: 'BaseConnection',
        methodName: 'execute',
        kind: 'Sync'
      }
    }
  ]
}

const poolGetConnection = {
  path: './mysql2/pool-get-connection.js',
  instrumentations: [
    {
      channelName: 'nr_poolGetConnection',
      module: { name: 'mysql2', versionRange: '>=3.0.0 <3.11.5', filePath: 'lib/pool.js' },
      functionQuery: {
        className: 'Pool',
        methodName: 'getConnection',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_poolGetConnection',
      module: { name: 'mysql2', versionRange: '>=3.11.5', filePath: 'lib/base/pool.js' },
      functionQuery: {
        className: 'BasePool',
        methodName: 'getConnection',
        kind: 'Sync'
      }
    }
  ]
}

module.exports = {
  mysql2: [
    connectionQuery,
    connectionExecute,
    poolGetConnection
  ]
}
