/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const CassandraShutdownSubscriber = require('./client-shutdown')

/**
 * Subscribes to the `shutdown` event in `cassandra-driver`.
 */
class LegacyCassandraShutdownSubscriber extends CassandraShutdownSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_legacyShutdown' })
    this.events = ['asyncStart', 'asyncEnd']
    this.callback = -1
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

module.exports = LegacyCassandraShutdownSubscriber
