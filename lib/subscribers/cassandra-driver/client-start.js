/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbOperationSubscriber = require('../db-operation')

/**
 * Subscribes to the `start` event in `cassandra-driver`'s
 * `RequestExecution` class.
 */
class CassandraStartSubscriber extends DbOperationSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_start', packageName: 'cassandra-driver', system: 'Cassandra' })
    this.events = ['asyncEnd']
    this.operation = 'start'
  }

  handler(data, ctx) {
    const { self } = data
    this.setParameters(self?._parent?.client)
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

module.exports = CassandraStartSubscriber
