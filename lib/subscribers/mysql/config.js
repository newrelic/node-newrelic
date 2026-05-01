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
    poolGetConnection
  ]
}
