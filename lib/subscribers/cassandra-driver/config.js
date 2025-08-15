/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const cassandraBatchConfig = {
  path: './cassandra-driver/client-batch.js',
  instrumentations: [
    {
      channelName: 'nr_batch',
      module: { name: 'cassandra-driver', versionRange: '>=4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: 'batch',
        kind: 'Async'
      }
    },
  ]
}

const cassandraConnectConfig = {
  path: './cassandra-driver/client-connect.js',
  instrumentations: [
    {
      channelName: 'nr_connect',
      module: { name: 'cassandra-driver', versionRange: '>=4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: 'connect',
        kind: 'Async'
      }
    },
  ]
}

const cassandraExecuteConfig = {
  path: './cassandra-driver/client-execute.js',
  instrumentations: [
    {
      channelName: 'nr_execute',
      module: { name: 'cassandra-driver', versionRange: '>=4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: 'execute',
        kind: 'Async'
      }
    },
  ]
}

const cassandraShutdownConfig = {
  path: './cassandra-driver/client-shutdown.js',
  instrumentations: [
    {
      channelName: 'nr_shutdown',
      module: { name: 'cassandra-driver', versionRange: '>=4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: 'shutdown',
        kind: 'Async'
      }
    },
  ]
}

module.exports = {
  'cassandra-driver': [
    cassandraBatchConfig,
    cassandraConnectConfig,
    cassandraExecuteConfig,
    cassandraShutdownConfig,
  ]
}
