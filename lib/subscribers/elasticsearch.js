/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const DbQuerySubscriber = require('./db-query')
const stringify = require('json-stringify-safe')
const { queryParser } = require('../db/query-parsers/elasticsearch')

class ElasticSearchSubscriber extends DbQuerySubscriber {
  constructor(agent, id) {
    id = id || '@elastic/elasticsearch:nr_request'
    super(agent, id, 'ElasticSearch')
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

class ElasticSearchTransportSubscriber extends ElasticSearchSubscriber {
  constructor(agent) {
    super(agent, '@elastic/transport:nr_request', 'ElasticSearch')
  }
}

const elasticSearchConfig = {
  package: '@elastic/elasticsearch',
  instrumentations: [
    {
      channelName: 'nr_request',
      module: { name: '@elastic/elasticsearch', versionRange: '>=7.16.0', filePath: 'lib/Transport.js' },
      functionQuery: {
        className: 'Transport',
        methodName: 'request',
        kind: 'Async'
      }
    },
  ]
}

const elasticSearchTransportConfig = {
  package: '@elastic/transport',
  instrumentations: [
    {
      channelName: 'nr_request',
      module: { name: '@elastic/transport', versionRange: '>=8', filePath: 'lib/Transport.js' },
      functionQuery: {
        className: 'Transport',
        methodName: 'request',
        kind: 'Async'
      }
    }
  ]
}

module.exports = {
  elasticSearchConfig,
  elasticSearchTransportConfig,
  ElasticSearchSubscriber,
  ElasticSearchTransportSubscriber
}
