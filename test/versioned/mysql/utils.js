/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/**
 *
 * @param pool
 * @param callback
 * @param counter
 */
function getClient(pool, callback, counter = 1) {
  counter++

  pool.acquire(function (err, client) {
    if (err) {
      if (counter < 10) {
        pool.destroy(client)
        getClient(pool, callback, counter)
      } else {
        return callback(new Error("Couldn't connect to DB after 10 attempts."))
      }
    } else {
      callback(null, client)
    }
  })
}

/**
 *
 * @param root0
 * @param root0.pool
 * @param root0.params
 * @param root0.database
 * @param root0.table
 * @param callback
 */
function lookup({ pool, params, database, table }, callback) {
  if (!params.id) {
    return callback(new Error('Must include ID to look up.'))
  }

  getClient(pool, (err, client) => {
    if (err) {
      return callback(err)
    }

    const query = 'SELECT *' + '  FROM ' + database + '.' + table + ' WHERE id = ?'
    client.query(query, [params.id], function (err, results) {
      pool.release(client) // always release back to the pool

      if (err) {
        return callback(err)
      }

      callback(null, results.length ? results[0] : results)
    })
  })
}

module.exports = {
  getClient,
  lookup
}
