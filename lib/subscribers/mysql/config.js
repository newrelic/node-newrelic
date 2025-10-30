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

module.exports = {
  mysql: [
    connectionQuery,
    poolQuery,
    poolNamespaceQuery,
    poolGetConnection,
  ]
}
