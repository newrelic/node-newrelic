/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const connectConfig = {
  path: './pg/connect.js',
  instrumentations: [
    {
      channelName: 'nr_connect',
      module: { name: 'pg', versionRange: '>=8.3.0', filePath: 'lib/client.js' },
      functionQuery: {
        className: 'Client',
        methodName: 'connect',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_connect',
      module: { name: 'pg', versionRange: '>=8.2.0 <8.3.0', filePath: 'lib/client.js' },
      functionQuery: {
        moduleName: 'Client',
        expressionName: 'connect',
        kind: 'Async'
      }
    }
  ]
}

const queryConfig = {
  path: './pg/query.js',
  instrumentations: [
    {
      channelName: 'nr_query',
      module: { name: 'pg', versionRange: '>=8.3.0', filePath: 'lib/client.js' },
      functionQuery: {
        className: 'Client',
        methodName: 'query',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_query',
      module: { name: 'pg', versionRange: '>=8.2.0 <8.3.0', filePath: 'lib/client.js' },
      functionQuery: {
        moduleName: 'Client',
        expressionName: 'query',
        kind: 'Async'
      }
    },
  ]
}

const nativeConnectConfig = {
  path: './pg/native-connect.js',
  instrumentations: [
    {
      channelName: 'nr_nativeConnect',
      module: { name: 'pg', versionRange: '>=8.2.0', filePath: 'lib/native/client.js' },
      functionQuery: {
        moduleName: 'Client',
        expressionName: 'connect',
        kind: 'Async'
      }
    },
  ]
}

const nativeQueryConfig = {
  path: './pg/native-query.js',
  instrumentations: [
    {
      channelName: 'nr_nativeQuery',
      module: { name: 'pg', versionRange: '>=8.2.0', filePath: 'lib/native/client.js' },
      functionQuery: {
        moduleName: 'Client',
        expressionName: 'query',
        kind: 'Async'
      }
    },
  ]
}

module.exports = {
  pg: [
    connectConfig,
    queryConfig,
    nativeConnectConfig,
    nativeQueryConfig,
  ]
}
