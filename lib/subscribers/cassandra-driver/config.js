/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const cassandraBatchConfig = {
  path: './cassandra-driver/client-batch.js',
  instrumentations: [
    {
      channelName: 'nr_batch',
      module: { name: 'cassandra-driver', versionRange: '>=3.4.0', filePath: 'lib/client.js' },
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
      channelName: 'nr__connect',
      module: { name: 'cassandra-driver', versionRange: '>=3.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: '_connect',
        kind: 'Async'
      }
    },
  ]
}

const cassandraInnerExecuteConfig = {
  path: './cassandra-driver/client-innerExecute.js',
  instrumentations: [
    {
      channelName: 'nr__innerExecute',
      module: { name: 'cassandra-driver', versionRange: '<4.4.0 >=3.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: '_innerExecute',
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
      module: { name: 'cassandra-driver', versionRange: '>=3.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: 'shutdown',
        kind: 'Async'
      }
    },
  ]
}

const cassandraStartConfig = {
  path: './cassandra-driver/client-start.js',
  instrumentations: [
    {
      channelName: 'nr_start',
      module: { name: 'cassandra-driver', versionRange: '<4.4.0 >=3.4.0', filePath: 'lib/request-execution.js' },
      functionQuery: {
        className: 'RequestExecution',
        methodName: 'start',
        kind: 'Async'
      }
    },
  ]
}

module.exports = {
  'cassandra-driver': [
    cassandraBatchConfig,
    cassandraConnectConfig,
    cassandraInnerExecuteConfig,
    cassandraExecuteConfig,
    cassandraShutdownConfig,
    cassandraStartConfig,
  ]
}
