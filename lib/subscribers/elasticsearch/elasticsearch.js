/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const DbQuerySubscriber = require('../db-query')
const stringify = require('json-stringify-safe')
const { queryParser } = require('../../db/query-parsers/elasticsearch')

class ElasticSearchSubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, packageName = '@elastic/elasticsearch', channelName = 'nr_request', system = 'ElasticSearch' } = {}) {
    super({ agent, logger, packageName, channelName, system })
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

module.exports = ElasticSearchSubscriber
