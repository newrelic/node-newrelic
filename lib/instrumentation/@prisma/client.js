/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const connection = Symbol('nrPrismaConnection')
const url = require('url')
const logger = require('../../logger').child({ component: 'prisma' })
const parseSql = require('../../db/query-parsers/sql')

/**
 * Parses a connection string. Most database engines in prisma are SQL and all
 * have similar engine strings.
 *
 * **Note**: This will not parse mongodb or sql server, instead will log a warning
 *
 * @param {string} provider prisma provider(i.e. mysql, postgres, mongodb)
 * @param {string} connectionUrl connection string
 * @returns {object} { host, port, database_name }
 */
function parseConnectionString(provider, connectionUrl) {
  let parameters = {}
  try {
    const parsedUrl = url.parse(connectionUrl)
    parameters = {
      host: parsedUrl.hostname,
      port: parsedUrl.port,
      database_name: parsedUrl.path && decodeURIComponent(parsedUrl.path.split('/')[0])
    }
  } catch (err) {
    logger.warn('Failed to parse connection string for %s: %s', provider, err.message)
  }
  return parameters
}

/**
 * Extracts either the raw query or the client method.
 * If raw sql it will be returned as a formatted string of `$executeRaw(select).users`
 *
 * @param {Array} args arguments to a prisma operation
 * @returns {string} formatted string of <collection>.<operation>
 */
function retrieveQuery(args) {
  if (Array.isArray(args)) {
    if (args[0].action === 'executeRaw') {
      const parsedQuery = parseSql(args[0]?.args?.query)
      return `$executeRaw(${parsedQuery.operation}).${parsedQuery.collection}`
    }
    return args[0].clientMethod
  }
}

/**
 * Parses formatted string to extract the collection and operation.
 * In case of executeRaw the string is created above in `retrieveQuery`
 *
 * @param {string} str formatted string of <collection>.<operation>
 * @returns {object} { collection, operation }
 */
function queryParser(str) {
  const [collection, operation] = str.split('.')

  return {
    collection,
    operation
  }
}

/**
 * Instruments the `@prisma/client` module, function that is
 * passed to `onRequire` when instantiating instrumentation.
 *
 * @param {object} _agent New Relic agent
 * @param {object} prisma resolved module
 * @param {string} _moduleName string representation of require/import path
 * @param {object} shim New Relic shim
 */
module.exports = async function initialize(_agent, prisma, _moduleName, shim) {
  shim.setDatastore(shim.PRISMA)
  shim.setParser(queryParser)

  shim.recordQuery(
    prisma.PrismaClient.prototype,
    '_executeRequest',
    function wrapExecuteRequest(shim, _executeRequest, _fnName, args) {
      const client = this

      return {
        promise: true,
        query: retrieveQuery(args),
        /**
         * Adds the relevant host, port, database_name parameters
         * to the active segment
         */
        inContext() {
          if (!client[connection]) {
            client._engine.getConfig().then((prismaConfig) => {
              const activeDatasource = prismaConfig?.datasources[0]
              const dbParams = parseConnectionString(
                activeDatasource?.provider,
                activeDatasource?.url?.value
              )
              shim.captureInstanceAttributes(dbParams.host, dbParams.port, dbParams.database_name)
              client[connection] = dbParams
            })
          } else {
            shim.captureInstanceAttributes(
              client[connection].host,
              client[connection].port,
              client[connection].database_name
            )
          }
        }
      }
    }
  )
}
