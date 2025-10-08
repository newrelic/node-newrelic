/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const PgConnectSubscriber = require('./connect.js')

/**
 * Subscribes to the `connect` event for PostgreSQL's (`pg`) native `Client` class.
 */
class PgNativeConnectSubscriber extends PgConnectSubscriber {
  constructor({ agent, logger, channelName = 'nr_nativeConnect' }) {
    super({ agent, logger, channelName })
    this.events = ['asyncStart', 'asyncEnd']
    this.propagateContext = true
  }
}

module.exports = PgNativeConnectSubscriber
