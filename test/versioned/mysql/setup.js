/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const params = require('../../lib/params')
const setup = require('./helpers')
module.exports = exports = setup
exports.pool = setupPool

function setupPool(user, database, mysql, generic, logger) {
  return new generic.Pool({
    name: 'mysql',
    min: 2,
    max: 6,
    idleTimeoutMillis: 250,

    log: function (message) {
      logger.info(message)
    },

    create: function (callback) {
      const client = mysql.createConnection({
        user,
        database,
        host: params.mysql_host,
        port: params.mysql_port
      })

      client.on('error', function (err) {
        logger.error('MySQL connection errored out, destroying connection')
        logger.error(err)
        this.destroy(client)
      })

      client.connect((err) => {
        if (err) {
          logger.error('MySQL client failed to connect. Does `agent_integration` exist?')
        }

        callback(err, client)
      })
    },

    destroy: function (client) {
      logger.info('Destroying MySQL connection')
      client.end()
    }
  })
}
