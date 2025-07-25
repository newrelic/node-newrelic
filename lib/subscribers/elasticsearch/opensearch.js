/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const ElasticSearchSubscriber = require('./elasticsearch.js')
class OpenSearchSubscriber extends ElasticSearchSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@opensearch-project/opensearch', channelName: 'nr_request', system: 'OpenSearch' })
  }
}

module.exports = OpenSearchSubscriber
