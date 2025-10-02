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

  /**
   * @override
   * Unlike `pg`, `pg-native`'s `Client` does not expose the connection
   * parameters directly.
   * Instead, we can extract them from the context from the `connect` event.
   *
   * TODO: However, the parent may not always be a Postgres connect segment
   * nor would the connect segment even be in the same transaction.
   * @param {object} client `pg-native` Client instance
   * @param {object} ctx context from the parent
   */
  setParameters(client, ctx) {
    const parentAttrs = ctx?._segment?.attributes?.attributes
    if (parentAttrs) {
      this.parameters = {}
      this.parameters.product = this.system
      this.parameters.database_name = parentAttrs?.database_name?.value
      this.parameters.host = parentAttrs?.host?.value
      this.parameters.port_path_or_id = parentAttrs?.port_path_or_id?.value
    } else {
      super.setParameters(client)
    }
  }
}

module.exports = PgNativeQuerySubscriber
