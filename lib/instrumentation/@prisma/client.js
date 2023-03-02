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

const semver = require('semver')

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
 * Extracts the raw query string from the appropriate location within the function args.
 * In 4.11.0 prisma refactored code and args are an array on .args, whereas before they
 * were an object on .args.
 *
 * @param {Array} args args passed to the prisma function
 * @param {string} pkgVersion prisma version
 * @returns {string} raw query string
 */
function extractQueryArgs(args, pkgVersion) {
  let query = ''
  try {
    if (semver.gte(pkgVersion, '4.11.0')) {
      query = args[0].args[0][0]
    } else {
      query = args[0].args.query
    }
  } catch (err) {
    logger.error('Failed to extract query from raw query: %s', err.message)
  }

  return query
}

/**
 * Extracts either the raw query or the client method.
 * If raw sql it will be returned as a formatted string of `users.executeRaw(select)`
 *
 * @param {Array} args arguments to a prisma operation
 * @param pkgVersion
 * @returns {string} formatted string of <collection>.<operation>
 */
function retrieveQuery(args, pkgVersion) {
  if (Array.isArray(args)) {
    const action = args[0].action
    if (RAW_COMMANDS.includes(action)) {
      const query = extractQueryArgs(args, pkgVersion)
      const parsedQuery = parseSql(query)

      let collection = ''
      if (parsedQuery.collection) {
        // Collection could be something like "public"."User", but what
        // we want here is the second part, the table name.
        const [part1, part2] = parsedQuery.collection.split('.')
        collection = part2 || part1
      }

      return `${collection}.${action}(${parsedQuery.operation})`
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
 * Extracts the prisma connection information from the engine. In pre 4.11.0 this existed
 * on a different object and was also a promise.
 *
 * @param {object} client prisma client instance
 * @param {string} pkgVersion prisma version
 * @returns {Promise} returns prisma connection configuration
 */
function extractPrismaConfig(client, pkgVersion) {
  if (semver.gte(pkgVersion, '4.11.0')) {
    return new Promise((resolve, reject) => {
      try {
        const config = client._engine.library.getConfig({
          datamodel: client._engine.datamodel,
          ignoreEnvVarErrors: true
        })
        resolve(config)
      } catch (err) {
        reject(err)
      }
    })
  }
  return client._engine.getConfig()
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
  const pkgVersion = shim.require('./package.json').version
  if (semver.lt(pkgVersion, '4.0.0')) {
    logger.warn(
      'Skipping instrumentation of @prisma/client.  Minimum supported version of library is 4.0.0, actual version %s',
      pkgVersion
    )
    return
  }

  shim.setDatastore(shim.PRISMA)
  shim.setParser(queryParser)

  shim.recordQuery(
    prisma.PrismaClient.prototype,
    '_executeRequest',
    function wrapExecuteRequest(shim, _executeRequest, _fnName, args) {
      const client = this

      return {
        promise: true,
        query: retrieveQuery(args, pkgVersion),
        /**
         * Adds the relevant host, port, database_name parameters
         * to the active segment
         */
        inContext: async function inContext() {
          if (!client[prismaConnection]) {
            try {
              const prismaConfig = await extractPrismaConfig(client, pkgVersion)
              const activeDatasource = prismaConfig?.datasources[0]
              const dbParams = parseConnectionString(
                activeDatasource?.provider,
                activeDatasource?.url
              )
              shim.captureInstanceAttributes(dbParams.host, dbParams.port, dbParams.dbName)
              client[prismaConnection] = dbParams
            } catch (err) {
              logger.error('Failed to retrieve prisma config in %s: %s', pkgVersion, err.message)
              client[prismaConnection] = {}
            }
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
