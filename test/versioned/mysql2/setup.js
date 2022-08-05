/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const params = require('../../lib/params')
const setup = require('../mysql/helpers')
const USER = 'mysql2_test_user'
const DATABASE = 'mysql2_agent_integration'
const TABLE = 'test'

module.exports = exports = setup.bind(null, USER, DATABASE, TABLE)
exports.pool = setupPool
exports.USER = USER
exports.DATABASE = DATABASE
exports.TABLE = TABLE

function setupPool(mysql, logger) {
  const generic = require('generic-pool')

  const pool = new generic.Pool({
    name: 'mysql2',
    min: 2,
    max: 6,
    idleTimeoutMillis: 250,

    log: function (message) {
      logger.info(message)
    },

    create: function (callback) {
      const client = mysql.createConnection({
        user: USER,
        database: DATABASE,
        host: params.mysql_host,
        port: params.mysql_port
      })

      client.on('error', function (err) {
        logger.error('MySQL connection errored out, destroying connection')
        logger.error(err)
        pool.destroy(client)
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

  return pool
}
