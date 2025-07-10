/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbQuerySubscriber = require('./db-query')
const stringify = require('json-stringify-safe')
const { queryParser } = require('../db/query-parsers/elasticsearch')

class OpenSearchSubscriber extends DbQuerySubscriber {
  constructor(agent, id) {
    id = id || '@opensearch-project/opensearch:nr_request'
    super(agent, id, 'OpenSearch')
    this.events = ['asyncEnd']
    this.opaque = true
  }

  handler(data, ctx) {
    const { self, arguments: args } = data
    this.queryString = stringify(args?.[0])
    this.setParameters(self)
    return super.handler(data, ctx)
  }

  setParameters(self) {
    this.parameters = {}
    this.parameters.product = this.system
    const connectionPool = self?.connectionPool?.connections?.[0]
    if (connectionPool) {
      const host = connectionPool?.url?.host?.split(':')
      const port = connectionPool?.url?.port || host?.[1]
      this.parameters.host = host?.[0]
      this.parameters.port_path_or_id = port
    }
  }

  parseQuery(queryString) {
    return queryParser(queryString)
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
