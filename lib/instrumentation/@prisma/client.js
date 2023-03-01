/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { prismaConnection } = require('../../symbols')
const { URL } = require('url')
const logger = require('../../logger').child({ component: 'prisma' })
const parseSql = require('../../db/query-parsers/sql')
// Note: runCommandRaw is another raw command but it is mongo which we cannot parse as sql
const RAW_COMMANDS = ['executeRaw', 'queryRaw']

/**
 * Extracts the connection url from env var or the .value prop
 * Very similar to this helper: https://github.com/prisma/prisma/blob/main/packages/internals/src/utils/parseEnvValue.ts
 *
 * @param {string} datasource object from prisma config { url, fromEnvVar }
 * @returns {string} connection string
 */
function extractConnectionString(datasource = {}) {
  return process.env[datasource.fromEnvVar] || datasource.value
}
/**
 * Parses a connection string. Most database engines in prisma are SQL and all
 * have similar engine strings.
 *
 * **Note**: This will not parse ms sql server, instead will log a warning
 *
 * @param {string} provider prisma provider(i.e. mysql, postgres, mongodb)
 * @param {string} datasource object from prisma config { url, fromEnvVar }
 * @returns {object} { host, port, dbName }
 */
function parseConnectionString(provider, datasource) {
  const connectionUrl = extractConnectionString(datasource)

  let parameters = {}
  try {
    const parsedUrl = new URL(connectionUrl)
    parameters = {
      host: parsedUrl.hostname,
      port: parsedUrl.port,
      dbName: parsedUrl.pathname && decodeURIComponent(parsedUrl.pathname.split('/')[1])
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
    const action = args[0].action
    if (RAW_COMMANDS.includes(action)) {
      const parsedQuery = parseSql(args[0]?.args?.query)
      return `${action}(${parsedQuery.operation}).${parsedQuery.collection}`
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
          if (!client[prismaConnection]) {
            client._engine.getConfig().then((prismaConfig) => {
              const activeDatasource = prismaConfig?.datasources[0]
              const dbParams = parseConnectionString(
                activeDatasource?.provider,
                activeDatasource?.url
              )
              shim.captureInstanceAttributes(dbParams.host, dbParams.port, dbParams.dbName)
              client[prismaConnection] = dbParams
            })
          } else {
            shim.captureInstanceAttributes(
              client[prismaConnection].host,
              client[prismaConnection].port,
              client[prismaConnection].dbName
            )
          }
        }
      }
    }
  )
}
