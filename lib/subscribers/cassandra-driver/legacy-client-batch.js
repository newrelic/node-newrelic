/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const CassandraBatchSubscriber = require('./client-batch')

/**
 * Subscribes to the `batch` event in `cassandra-driver`
 * and extracts relevant information from the queries.
 */
class LegacyCassandraBatchSubscriber extends CassandraBatchSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_legacyBatch' })
    this.events = ['asyncStart', 'asyncEnd']
    this.callback = -1
  }
}

module.exports = LegacyCassandraBatchSubscriber
