/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Query subscriber configs
const connectionQuery = {
  path: './mysql/connection-query.js',
  instrumentations: [
    {
      channelName: 'nr_connectionQuery',
      module: { name: 'mysql', versionRange: '>=2.16.0', filePath: 'lib/Connection.js' },
      functionQuery: {
        moduleName: 'Connection',
        expressionName: 'query',
        kind: 'Sync'
      }
    }
  ]
}

const connectionQuery2 = {
  path: './mysql/connection-query2.js',
  instrumentations: [
    {
      channelName: 'nr_connectionQuery2',
      module: { name: 'mysql2', versionRange: '>=2.0.0 <3.0.0', filePath: 'lib/connection.js' },
      functionQuery: {
        className: 'Connection',
        methodName: 'query',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_connectionQuery2',
      module: { name: 'mysql2', versionRange: '>=3.0.0', filePath: 'lib/base/connection.js' },
      functionQuery: {
        className: 'BaseConnection',
        methodName: 'query',
        kind: 'Sync'
      }
    }
  ]
}

const poolQuery = {
  path: './mysql/pool-query.js',
  instrumentations: [
    {
      channelName: 'nr_poolQuery',
      module: { name: 'mysql', versionRange: '>=2.16.0', filePath: 'lib/Pool.js' },
      functionQuery: {
        moduleName: 'Pool',
        expressionName: 'query',
        kind: 'Sync'
      }
    }
  ]
}

const poolQuery2 = {
  path: './mysql/pool-query2.js',
  instrumentations: [
    {
      channelName: 'nr_poolQuery2',
      module: { name: 'mysql2', versionRange: '>2.0.0 <3.0.0', filePath: 'lib/pool.js' },
      functionQuery: {
        className: 'Pool',
        methodName: 'query',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_poolQuery2',
      module: { name: 'mysql2', versionRange: '>=3.0.0', filePath: 'lib/base/pool.js' },
      functionQuery: {
        className: 'BasePool',
        methodName: 'query',
        kind: 'Sync'
      }
    }
  ]
}

const poolNamespaceQuery = {
  path: './mysql/pool-namespace-query.js',
  instrumentations: [
    {
      channelName: 'nr_poolNamespaceQuery',
      module: { name: 'mysql', versionRange: '>=2.16.0', filePath: 'lib/PoolNamespace.js' },
      functionQuery: {
        moduleName: 'PoolNamespace',
        expressionName: 'query',
        kind: 'Sync'
      }
    }
  ]
}

const poolNamespaceQuery2 = {
  path: './mysql/pool-namespace-query2.js',
  instrumentations: [
    {
      channelName: 'nr_poolNamespaceQuery2',
      module: { name: 'mysql2', versionRange: '>=3.0.0', filePath: 'lib/pool_cluster.js' },
      functionQuery: {
        className: 'PoolNamespace',
        methodName: 'query',
        kind: 'Sync'
      }
    }
  ]
}

// Propagation subscriber configs
const poolGetConnection = {
  path: './mysql/pool-get-connection.js',
  instrumentations: [
    {
      channelName: 'nr_poolGetConnection',
      module: { name: 'mysql', versionRange: '>=2.16.0', filePath: 'lib/Pool.js' },
      functionQuery: {
        moduleName: 'Pool',
        expressionName: 'getConnection',
        kind: 'Sync'
      }
    }
  ]
}

const protocolEnqueue = {
  path: './mysql/protocol-enqueue.js',
  instrumentations: [
    {
      channelName: 'nr_protocolEnqueue',
      module: { name: 'mysql', versionRange: '>=2.16.0', filePath: 'lib/protocol/Protocol.js' },
      functionQuery: {
        moduleName: 'Protocol',
        expressionName: '_enqueue',
        kind: 'Sync'
      }
    }
  ]
}

const connectionAddCommand = {
  path: './mysql/connection-add-command.js',
  instrumentations: [
    {
      channelName: 'nr_connectionAddCommand',
      module: { name: 'mysql2', versionRange: '>=2.0.0 <3.0.0', filePath: 'lib/connection.js' },
      functionQuery: {
        className: 'Connection',
        methodName: 'addCommand',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_connectionAddCommand',
      module: { name: 'mysql2', versionRange: '>=3.0.0', filePath: 'lib/base/connection.js' },
      functionQuery: {
        className: 'BaseConnection',
        methodName: 'addCommand',
        kind: 'Sync'
      }
    },
  ]
}

const connectionExecute = {
  path: './mysql/connection-execute.js',
  instrumentations: [
    {
      channelName: 'nr_connectionExecute',
      module: { name: 'mysql2', versionRange: '>=2.0.0 <3.0.0', filePath: 'lib/connection.js' },
      functionQuery: {
        className: 'Connection',
        methodName: 'execute',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_connectionExecute',
      module: { name: 'mysql2', versionRange: '>=3.0.0', filePath: 'lib/base/connection.js' },
      functionQuery: {
        className: 'BaseConnection',
        methodName: 'execute',
        kind: 'Sync'
      }
    }
  ]
}

module.exports = {
  mysql: [
    connectionQuery,
    poolQuery,
    poolGetConnection,
    poolNamespaceQuery,
    protocolEnqueue
  ],
  mysql2: [
    connectionQuery2,
    poolQuery2,
    connectionAddCommand,
    connectionExecute,
    poolNamespaceQuery2
  ]
}
