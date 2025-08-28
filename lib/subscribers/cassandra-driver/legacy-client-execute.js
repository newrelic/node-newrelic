/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const CassandraExecuteSubscriber = require('./client-execute')
/**
 * Subscribes to the `execute` event in `cassandra-driver`
 * and extracts relevant information from the query.
 */
class LegacyCassandraExecuteSubscriber extends CassandraExecuteSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_legacyExecute' })
    this.events = ['asyncStart', 'asyncEnd']
    this.callback = -1
  }
}

module.exports = LegacyCassandraExecuteSubscriber
