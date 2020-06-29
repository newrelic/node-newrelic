/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var a = require('async')
var params = require('../../lib/params')


module.exports = exports = setup
exports.pool = setupPool

function setup(mysql, cb) {
  a.series([
    // 1. Create the user and database as root.
    function(cb) {
      var client = mysql.createConnection({
        host: params.mysql_host,
        port: params.mysql_port,
        user: 'root',
        database: 'mysql'
      })

      a.eachSeries([
        'CREATE USER test_user',
        'GRANT ALL ON *.* TO `test_user`',
        'CREATE DATABASE IF NOT EXISTS `agent_integration`'
      ], function(sql, cb) {
        client.query(sql, function(err) {
          // Travis uses MySQL 5.4 which does not support `IF NOT EXISTS` for
          // `CREATE USER`. This means we will likely be creating the test user
          // in a database that already has the test user and so we should
          // ignore that error.
          if (err && !/^CREATE USER/.test(sql)) {
            cb(err)
          } else {
            cb()
          }
        })
      }, function(err) {
        client.end()
        cb(err)
      })
    },

    // 2. Create the table and data as test user.
    function(cb) {
      var client = mysql.createConnection({
        host: params.mysql_host,
        port: params.mysql_port,
        user: 'test_user',
        database: 'agent_integration'
      })

      a.eachSeries([
        [
          'CREATE TABLE IF NOT EXISTS `test` (',
          '  `id`         INTEGER(10) PRIMARY KEY AUTO_INCREMENT,',
          '  `test_value` VARCHAR(255)',
          ')'
        ].join('\n'),
        'TRUNCATE TABLE `test`',
        'INSERT INTO `test` (`test_value`) VALUE ("hamburgefontstiv")'
      ], function(sql, cb) {
        client.query(sql, cb)
      }, function(err) {
        client.end()
        cb(err)
      })
    }
  ], cb)
}

function setupPool(mysql, logger) {
  var generic = require('generic-pool')

  var pool = new generic.Pool({
    name: 'mysql2',
    min: 2,
    max: 6,
    idleTimeoutMillis: 250,

    log: function(message) { logger.info(message) },

    create: function(callback) {
      var client = mysql.createConnection({
        user: 'test_user',
        database: 'agent_integration',
        host: params.mysql_host,
        port: params.mysql_port
      })

      client.on('error', function(err) {
        logger.error('MySQL connection errored out, destroying connection')
        logger.error(err)
        pool.destroy(client)
      })

      client.connect(function cb_connect(err) {
        if (err) {
          logger.error('MySQL client failed to connect. Does `agent_integration` exist?')
        }

        callback(err, client)
      })
    },

    destroy: function(client) {
      logger.info('Destroying MySQL connection')
      client.end()
    }
  })

  return pool
}
