/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbQuerySubscriber = require('../db-query')

/**
 * Given the arguments for Cassandra's `batch` method, this finds the first
 * query in the batch.
 *
 * @param {Array} args - original arguments passed to the batch function
 * @returns {string} The query for this batch request.
 */
function findBatchQueryArg(args) {
  const sql = (args[0] && args[0][0]) || ''
  return sql.query || sql
}

/**
 * Subscribes to the `batch` event in `cassandra-driver`
 * and extracts relevant information from the queries.
 */
class CassandraBatchSubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_batch' }) {
    super({ agent, logger, channelName, packageName: 'cassandra-driver', system: 'Cassandra' })
    this.events = ['asyncEnd']
    this.isBatch = true
  }

  handler(data, ctx) {
    const { self, arguments: args } = data
    this.queryString = findBatchQueryArg(args)
    this.setParameters(self)
    return super.handler(data, ctx)
  }

  setParameters(self) {
    this.parameters = {}
    this.parameters.product = this.system
    this.parameters.database_name = self?.keyspace
    this.parameters.host = self?.options?.contactPoints?.[0]
    this.parameters.port_path_or_id = self?.options?.protocolOptions?.port
  }
}

module.exports = CassandraBatchSubscriber
