/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { prismaConnection, prismaModelCall } = require('../../symbols')
const { URL } = require('url')
const logger = require('../../logger').child({ component: 'prisma' })
const parseSql = require('../../db/query-parsers/sql')
// Note: runCommandRaw is another raw command but it is mongo which we cannot parse as sql
const RAW_COMMANDS = ['executeRaw', 'queryRaw']

const semver = require('semver')
const { getSchema } = require('@mrleebo/prisma-ast')

/**
 * The library we use to parse the prisma schema retains double quotes around
 * strings, and they need to be stripped
 *
 * @param {string} [str=''] string to strip double-quotes from
 * @returns {string} stripped string
 */
function trimQuotes(str = '') {
  return str.match(/"(.*)"/)[1]
}

/**
 * You can set the connection string in schema as raw string,
 * env var mapping, or an override at client instantiation time.
 *
 * @param {*} url string/object value of url in datsource stanza of schema
 * @param {string} overrideUrl value of url in overrides at client instantiation
 * @returns {string} properly parsed connection url
 */
function parseDataModelUrl(url, overrideUrl) {
  let parsedUrl = ''

  if (overrideUrl) {
    parsedUrl = overrideUrl
  } else if (typeof url === 'string') {
    parsedUrl = trimQuotes(url)
  } else if (url.name && url.name === 'env') {
    const envVar = trimQuotes(url.params[0])
    parsedUrl = process.env[envVar]
  }

  return parsedUrl
}

/**
 * Parses a connection string. Most database engines in prisma are SQL and all
 * have similar engine strings.
 *
 * **Note**: This will not parse ms sql server, instead will log a warning
 *
 * @param {string} provider prisma provider(i.e. mysql, postgres, mongodb)
 * @param {string} connectionUrl connection string to db
 * @returns {object} { host, port, dbName }
 */
function parseConnectionString(provider, connectionUrl) {
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
      // Prisma 4.16.0 moved the query to a `strings` property
      query = args[0].args[0] || args[0].args.strings[0]
      if (Array.isArray(query)) {
        // RawUnsafe pass in a string, but plain Raw methods pass in an
        // array containing a prepared SQL statement and the SQL parameters
        query = query[0]
      }
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
 *
 * @param {Array} args arguments to a prisma operation
 * @param {string} pkgVersion prisma version
 * @returns {string} query raw query string or model call <collection>.<operation>
 */
function retrieveQuery(args, pkgVersion) {
  if (Array.isArray(args)) {
    const action = args[0].action
    if (RAW_COMMANDS.includes(action)) {
      return extractQueryArgs(args, pkgVersion)
    }

    // cast to string obj to attach symbol
    // this is done to tell query parser that we need to split string
    // to extract contents
    const clientMethod = new String(args[0].clientMethod)
    clientMethod[prismaModelCall] = true
    return clientMethod
  }
}

/**
 * Parses formatted string to extract the collection and operation.
 * In case of executeRaw the string is created above in `retrieveQuery`
 *
 * @param {string} query raw query string or model call <collection>.<operation>
 * @returns {object} { collection, operation, query }
 */
function queryParser(query) {
  if (query[prismaModelCall]) {
    const [collection, operation] = query.split('.')
    return {
      collection,
      operation,
      // this is a String object, need to parse to string literal
      query: query.toString()
    }
  }
  return parseSql(query)
}

/**
 * Extracts the prisma connection information from the engine. This used to use
 * prisma functions available on engine `getConfig` but that's no longer accessible.
 * Instead we went the route of parsing the schema DSL.
 *
 * @param {object} client prisma client instance
 * @returns {Promise} returns prisma datasource connection configuration { provider, url }
 */
function extractPrismaDatasource(client) {
  const { datamodel, datasourceOverrides: overrides } = client._engine
  const schema = getSchema(datamodel)
  const datasource = schema.list.filter(({ type }) => type === 'datasource')[0]
  const urlData = datasource.assignments.filter(({ key }) => key === 'url')[0].value
  const url = parseDataModelUrl(urlData, overrides[datasource.name])
  return {
    provider: trimQuotes(datasource.assignments.filter(({ key }) => key === 'provider')[0].value),
    url
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
        inContext: function inContext() {
          if (!client[prismaConnection]) {
            try {
              const activeDatasource = extractPrismaDatasource(client)
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
