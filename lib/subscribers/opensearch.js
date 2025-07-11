/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { ElasticSearchSubscriber } = require('./elasticsearch')
class OpenSearchSubscriber extends ElasticSearchSubscriber {
  constructor(agent) {
    super(agent, '@opensearch-project/opensearch:nr_request', 'OpenSearch')
  }
}

const openSearchConfig = {
  package: '@opensearch-project/opensearch',
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
}

module.exports = {
  OpenSearchSubscriber,
  openSearchConfig
}
