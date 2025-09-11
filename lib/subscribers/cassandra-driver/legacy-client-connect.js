/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const CassandraConnectSubscriber = require('./client-connect')

/**
 * Subscribes to the `connect` event in `cassandra-driver`'s `Client`.
 */
class LegacyCassandraConnectSubscriber extends CassandraConnectSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_legacyConnect' })
    this.events = ['asyncStart', 'asyncEnd']
    this.internal = true
    this.callback = -1
  }
}

module.exports = LegacyCassandraConnectSubscriber
