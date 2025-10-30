/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// MySQL2 subscriber configs
const connectionQuery2 = {
  path: './mysql2/connection-query.js',
  instrumentations: [
    {
      channelName: 'nr_connectionQuery',
      module: { name: 'mysql2', versionRange: '>=2.0.0 <3.11.5', filePath: 'lib/connection.js' },
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

const poolQuery2 = {
  path: './mysql2/pool-query.js',
  instrumentations: [
    {
      channelName: 'nr_poolQuery',
      module: { name: 'mysql2', versionRange: '>2.0.0 <3.11.5', filePath: 'lib/pool.js' },
      functionQuery: {
        className: 'Pool',
        methodName: 'query',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_poolQuery',
      module: { name: 'mysql2', versionRange: '>=3.11.5', filePath: 'lib/base/pool.js' },
      functionQuery: {
        className: 'BasePool',
        methodName: 'query',
        kind: 'Sync'
      }
    }
  ]
}

const poolNamespaceQuery2 = {
  path: './mysql2/pool-namespace-query.js',
  instrumentations: [
    {
      channelName: 'nr_poolNamespaceQuery',
      // The `PoolNamespace` class did not get moved into lib/base in mysql2@3.11.5.
      module: { name: 'mysql2', versionRange: '>=3.0.0', filePath: 'lib/pool_cluster.js' },
      functionQuery: {
        className: 'PoolNamespace',
        methodName: 'query',
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
      module: { name: 'mysql2', versionRange: '>2.0.0 <3.11.5', filePath: 'lib/pool.js' },
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

const connectionExecute = {
  path: './mysql2/connection-execute.js',
  instrumentations: [
    {
      channelName: 'nr_connectionExecute',
      module: { name: 'mysql2', versionRange: '>=2.0.0 <3.11.5', filePath: 'lib/connection.js' },
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

module.exports = {
  mysql2: [
    connectionQuery2,
    poolQuery2,
    poolNamespaceQuery2,
    poolGetConnection,
    connectionExecute,
  ]
}
