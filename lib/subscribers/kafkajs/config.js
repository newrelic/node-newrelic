/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const modName = 'kafkajs'

module.exports = {
  [modName]: [{
    path: './kafkajs/client-constructor.js',
    instrumentations: [{
      module: {
        name: modName,
        filePath: 'src/index.js',
        versionRange: '>=2.0.0'
      },
      channelName: 'nr_constructor',
      functionQuery: {
        className: 'Client'
      }
    }]
  }, {
    // kafkajs builds a brand new internal `Cluster` on every call to
    // `.producer()` — it isn't reachable from the top-level client, so we
    // have to capture it right where kafkajs itself creates it.
    path: './kafkajs/producer-cluster-capture.js',
    instrumentations: [{
      module: {
        name: modName,
        filePath: 'src/producer/index.js',
        versionRange: '>=2.0.0'
      },
      channelName: 'nr_producerClusterCapture',
      functionQuery: {
        expressionName: 'exports',
        kind: 'Sync'
      }
    }]
  }, {
    // Same as above, for `.consumer()`.
    path: './kafkajs/consumer-cluster-capture.js',
    instrumentations: [{
      module: {
        name: modName,
        filePath: 'src/consumer/index.js',
        versionRange: '>=2.0.0'
      },
      channelName: 'nr_consumerClusterCapture',
      functionQuery: {
        expressionName: 'exports',
        kind: 'Sync'
      }
    }]
  }]
}
