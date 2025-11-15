/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// there are diff subscribers for handling callback based code. In 4.4.0+ you can specify callbacks but they're all wrapped around promises so you don't have to wrap the callback in that case
const legacyBatchConfig = {
  path: './cassandra-driver/legacy-client-batch.js',
  instrumentations: [
    {
      channelName: 'nr_legacyBatch',
      module: { name: 'cassandra-driver', versionRange: '>=3.4.0 <4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: 'batch',
        kind: 'Async'
      }
    },
  ]
}

const legacyConnectConfig = {
  path: './cassandra-driver/legacy-client-connect.js',
  instrumentations: [
    {
      channelName: 'nr_legacyConnect',
      module: { name: 'cassandra-driver', versionRange: '>=3.4.0 <4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: 'connect',
        kind: 'Async'
      }
    },
  ]
}

const legacyExecuteConfig = {
  path: './cassandra-driver/legacy-client-execute.js',
  instrumentations: [
    {
      channelName: 'nr_legacyExecute',
      module: { name: 'cassandra-driver', versionRange: '>=3.4.0 <4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: 'execute',
        kind: 'Async'
      }
    }
  ]
}

const legacyEachRowConfig = {
  path: './cassandra-driver/legacy-client-each-row.js',
  instrumentations: [
    {
      channelName: 'nr_legacyEachRow',
      module: { name: 'cassandra-driver', versionRange: '>=3.4.0 <4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: 'eachRow',
        kind: 'Async'
      }
    },
  ]
}

const legacyShutdownConfig = {
  path: './cassandra-driver/legacy-client-shutdown.js',
  instrumentations: [
    {
      channelName: 'nr_legacyShutdown',
      module: { name: 'cassandra-driver', versionRange: '>=3.4.0 <4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: 'shutdown',
        kind: 'Async'
      }
    },
  ]
}

const batchConfig = {
  path: './cassandra-driver/client-batch.js',
  instrumentations: [
    {
      channelName: 'nr_batch',
      module: { name: 'cassandra-driver', versionRange: '>=4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: '_batch',
        kind: 'Async'
      }
    },
  ]
}

const connectConfig = {
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

const executeConfig = {
  path: './cassandra-driver/client-execute.js',
  instrumentations: [
    {
      channelName: 'nr_execute',
      module: { name: 'cassandra-driver', versionRange: '>=4.4.0', filePath: 'lib/client.js' },
      functionQuery: {
        expressionName: '_execute',
        kind: 'Async'
      }
    }
  ]
}

const shutdownConfig = {
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
    batchConfig,
    connectConfig,
    executeConfig,
    shutdownConfig,
    legacyBatchConfig,
    legacyEachRowConfig,
    legacyConnectConfig,
    legacyExecuteConfig,
    legacyShutdownConfig
  ]
}
