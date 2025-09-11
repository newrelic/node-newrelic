/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbOperationSubscriber = require('../db-operation')

/**
 * Subscribes to the `connect` event in `cassandra-driver`'s `Client`.
 */
class CassandraConnectSubscriber extends DbOperationSubscriber {
  constructor({ agent, logger, channelName = 'nr_connect' }) {
    super({ agent, logger, channelName, packageName: 'cassandra-driver', system: 'Cassandra' })
    this.events = ['asyncEnd']
    this.operation = 'connect'
  }

  handler(data, ctx) {
    const { self } = data
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

module.exports = CassandraConnectSubscriber
