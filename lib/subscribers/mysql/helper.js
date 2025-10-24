/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const properties = require('../../util/properties')
const symbols = require('../../symbols')

/**
 * @typedef {object} DatastoreParameters
 * @property {string} host
 *  The host of the database server being interacted with. If provided, along
 *  with `port_path_or_id`, then an instance metric will also be generated for
 *  this database.
 * @property {number|string} port_path_or_id
 *  The port number or path to domain socket used to connect to the database
 *  server.
 * @property {string} database_name
 *  The name of the database being queried or operated on.
 * @property {string} collection
 *  The name of the collection or table being queried or operated on.
 */

/**
 * Extracts the query string from the function arguments.
 * @param {object[]} args the original query arguments
 * @returns {string} the extracted query string
 */
function extractQuery(args) {
  let query = ''

  // Figure out the query parameter.
  if (args[0] && typeof args[0] === 'string') {
    // query(sql [, values], callback)
    query = args[0]
  } else {
    // query(opts [, values], callback)
    query = args[0].sql
  }

  return query
}

/**
 *
 * @param {object} logger an instance of the New Relic agent logger
 * @param {object} queryable a MySQL object that has a `query` function e.g. `Connection` or `Pool`
 * @param {string} query the query string
 * @returns {DatastoreParameters} the relevant datastore parameters
 */
function getInstanceParameters(logger, queryable, query) {
  const parameters = {}
  let conf = queryable.config
  conf = conf?.connectionConfig || conf
  const databaseName = queryable[symbols.databaseName] || null

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

function extractDatabaseChangeFromUse(sql) {
  // The character ranges for this were pulled from
  // http://dev.mysql.com/doc/refman/5.7/en/identifiers.html

  // The lint rule being suppressed here has been evaluated, and it has been
  // determined that the regular expression is sufficient for our use case.
  // eslint-disable-next-line sonarjs/slow-regex
  const match = /^\s*use[^\w`]+([\w$\u0080-\uFFFF]+|`[^`]+`)[\s;]*$/i.exec(sql)
  return (match && match[1]) || null
}

function storeDatabaseName(queryable, query) {
  if (queryable[symbols.storeDatabase]) {
    const databaseName = extractDatabaseChangeFromUse(query)
    if (databaseName) {
      queryable[symbols.databaseName] = databaseName
    }
  }
}

module.exports = {
  extractQuery,
  getInstanceParameters,
  // exported for testing purposes
  extractDatabaseChangeFromUse
}
