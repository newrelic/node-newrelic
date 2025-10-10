/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

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

const poolGetConnection = {
  path: './mysql/pool-getConnection.js',
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

const poolNamespaceQuery = {
  path: './mysql/poolNamespace-query.js',
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

module.exports = {
  mysql: [
    connectionQuery,
    poolQuery,
    poolGetConnection,
    poolNamespaceQuery,
    protocolEnqueue
  ]
}
