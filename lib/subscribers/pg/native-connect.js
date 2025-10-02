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
    super({ agent, logger, channelName, packageName: 'pg-native' })
  }

  /**
   * @override
   * Unlike `pg`, `pg-native`'s `Client` does not expose the connection
   * parameters directly.
   * Instead, we can extract them from the first argument (a stringified
   * connection object) on the `connect` event.
   * @param {object} client `pg-native` Client instance
   * @param {string} con connection object as a string
   */
  setParameters(client, con) {
    if (con) {
      const extract = (key) => {
        const quoted = new RegExp(`${key}='([^']*)'`).exec(con)
        if (quoted) return quoted[1]
        const unquoted = new RegExp(`${key}=([^\\s]+)`).exec(con)
        return unquoted ? unquoted[1] : undefined
      }

      const dbname = extract('dbname')
      const host = extract('host')
      const port = extract('port')

      this.parameters = {}
      this.parameters.product = this.system
      this.parameters.database_name = dbname
      this.parameters.host = host
      this.parameters.port_path_or_id = port
    } else {
      super.setParameters(client)
    }
  }
}

module.exports = PgNativeConnectSubscriber
