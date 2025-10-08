/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const dbutils = require('../../db/utils')
const properties = require('../../util/properties')
const symbols = require('../../symbols')
const DatastoreParameters = require('../../shim/specs/params/datastore')

/**
 *
 * @param {object[]} args the original query arguments
 * @returns {object} { query, callback }
 */
function extractQueryArgs(args) {
  let query = ''
  let callback = null

  // Figure out the query parameter.
  if (args[0] && typeof args[0] === 'string') {
    // query(sql [, values], callback)
    query = args[0]
  } else {
    // query(opts [, values], callback)
    query = args[0].sql
  }

  // Then determine the query values and callback parameters.
  if (args[1] && Array.isArray(args[1])) {
    // query({opts|sql}, values, callback)
    callback = 2
  } else {
    // query({opts|sql}, callback)
    callback = 1
  }

  return {
    query,
    callback
  }
}

/**
 *
 * @param {object} logger an instance of the New Relic agent logger
 * @param {object} queryable a MySQL object that has a `query` function i.e. `Connection` or `Pool`
 * @param {string} query the query string
 * @returns {DatastoreParameters} the relevant datastore parameters
 */
function getInstanceParameters(logger, queryable, query) {
  const parameters = new DatastoreParameters()
  let conf = queryable.config
  conf = conf?.connectionConfig || conf

  // If the user sends a 'use my_db;` query, we need to update the databaseName
  const databaseName = queryable[symbols.databaseName] || dbutils.extractDatabaseChangeFromUse(query)
  if (databaseName) {
    parameters.database_name = databaseName
  }

  // Look at config for parameters
  if (conf) {
    parameters.database_name = databaseName || conf.database

    if (properties.hasOwn(conf, 'socketPath') && conf.socketPath) {
      // In the unix domain socket case we force the host to be localhost
      parameters.host = 'localhost'
      parameters.port_path_or_id = conf.socketPath
    } else {
      parameters.host = conf.host
      parameters.port_path_or_id = conf.port
    }
  } else {
    logger.trace('No query config detected, not collecting db instance data')
  }

  storeDatabaseName(queryable, query)
  return parameters
}

function storeDatabaseName(queryable, query) {
  if (queryable[symbols.storeDatabase]) {
    const databaseName = dbutils.extractDatabaseChangeFromUse(query)
    if (databaseName) {
      queryable[symbols.databaseName] = databaseName
    }
  }
}

module.exports = {
  extractQueryArgs,
  getInstanceParameters
}
