/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const CassandraEachRowSubscriber = require('./client-each-row')

/**
 * Subscribes to the `execute` event in `cassandra-driver`
 * and extracts relevant information from the query.
 */
class LegacyCassandraEachRowSubscriber extends CassandraEachRowSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_legacyEachRow' })
    this.events = ['asyncStart', 'asyncEnd']
    this.callback = -1
  }
}

module.exports = LegacyCassandraEachRowSubscriber
