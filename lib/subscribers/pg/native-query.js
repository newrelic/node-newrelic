/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const PgQuerySubscriber = require('./query.js')

/**
 * Subscribes to the `query` event for PostgreSQL's (`pg`) native `Client` class.
 */
class PgNativeQuerySubscriber extends PgQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_nativeQuery' }) {
    super({ agent, logger, channelName, packageName: 'pg-native' })
  }
}

module.exports = PgNativeQuerySubscriber
