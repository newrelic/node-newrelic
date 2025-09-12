/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'

module.exports = {
  '@elastic/elasticsearch': [{
    path: './elasticsearch/elasticsearch.js',
    instrumentations: [
      {
        channelName: 'nr_request',
        module: { name: '@elastic/elasticsearch', versionRange: '>=7.16.0', filePath: 'lib/Transport.js' },
        functionQuery: {
          className: 'Transport',
          methodName: 'request',
          kind: 'Async'
        }
      }
    ]
  }],
  '@elastic/transport': [{
    path: './elasticsearch/transport.js',
    instrumentations: [
      {
        channelName: 'nr_request',
        module: { name: '@elastic/transport', versionRange: '>=8.0.0', filePath: 'lib/Transport.js' },
        functionQuery: {
          className: 'Transport',
          methodName: 'request',
          kind: 'Async'
        }
      }
    ]
  }],
  '@opensearch-project/opensearch': [{
    path: './elasticsearch/opensearch.js',
    instrumentations: [
      {
        channelName: 'nr_request',
        module: { name: '@opensearch-project/opensearch', versionRange: '>=2.1.0', filePath: 'lib/Transport.js' },
        functionQuery: {
          className: 'Transport',
          methodName: 'request',
          kind: 'Async'
        }
      }
    ]
  }]
}
