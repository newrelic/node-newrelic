/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbOperationSubscriber = require('../db-operation')

/**
 * Subscribes to the `shutdown` event in `cassandra-driver`.
 */
class CassandraShutdownSubscriber extends DbOperationSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_shutdown', packageName: 'cassandra-driver', system: 'Cassandra' })
    this.events = ['asyncEnd']
    this.operation = 'shutdown'
  }

  handler(data, ctx) {
    const { self } = data
    this.setParameters(self)
    return super.handler(data, ctx)
  }

  setParameters() {
    this.parameters = {}
    this.parameters.product = this.system
  }
}

module.exports = CassandraShutdownSubscriber
