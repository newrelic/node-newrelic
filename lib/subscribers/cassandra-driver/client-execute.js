/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbQuerySubscriber = require('../db-query')

/**
 * Subscribes to the `execute` event in `cassandra-driver`
 * and extracts relevant information from the query.
 */
class CassandraExecuteSubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_execute' }) {
    super({ agent, logger, channelName, packageName: 'cassandra-driver', system: 'Cassandra' })
    this.events = ['asyncEnd']
  }

  handler(data, ctx) {
    const { self, arguments: args } = data
    this.queryString = args?.[0]
    this.setParameters(self)
    return super.handler(data, ctx)
  }

  setParameters(self) {
    this.parameters = {}
    this.parameters.product = this.system
    this.parameters.database_name = self?.keyspace
    this.parameters.host = self?.controlConnection?.connection?.address
    this.parameters.port_path_or_id = self?.controlConnection?.connection?.port
  }
}

module.exports = CassandraExecuteSubscriber
