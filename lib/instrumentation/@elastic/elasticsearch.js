/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const semver = require('semver')
const logger = require('../../logger').child({ component: 'ElasticSearch' })
const { isNotEmpty } = require('../../util/objects')

/**
 * Instruments the `@elastic/elasticsearch` module. This function is
 * passed to `onRequire` when instantiating instrumentation.
 *
 * @param {object} _agent New Relic agent
 * @param {object} elastic resolved module
 * @param {string} _moduleName string representation of require/import path
 * @param {object} shim New Relic shim
 * @returns {void}
 */
module.exports = function initialize(_agent, elastic, _moduleName, shim) {
  const pkgVersion = shim.pkgVersion
  if (semver.lt(pkgVersion, '7.13.0')) {
    shim &&
      shim.logger.debug(
        `ElasticSearch support is for versions 7.13.0 and above. Not instrumenting ${pkgVersion}.`
      )
    return
  }

  shim.setDatastore(shim.ELASTICSEARCH)
  shim.setParser(queryParser)

  shim.recordQuery(elastic.Transport.prototype, 'request', function wrapQuery(shim, _, __, args) {
    const ctx = this
    return {
      query: JSON.stringify(args?.[0]),
      promise: true,
      opaque: true,
      inContext: function inContext() {
        getConnection.call(ctx, shim)
      }
    }
  })
}

/**
 * Parses the parameters sent to elasticsearch for collection,
 * method, and query
 *
 * @param {object} params Query object received by the datashim.
 * Required properties: path {string}, method {string}.
 * Optional properties: querystring {string}, body {object}, and
 * bulkBody {object}
 * @returns {object} consisting of collection {string}, operation {string},
 * and query {string}
 */
function queryParser(params) {
  params = JSON.parse(params)
  const { collection, operation } = parsePath(params.path, params.method)

  // the substance of the query may be in querystring or in body.
  let queryParam = {}
  if (isNotEmpty(params.querystring)) {
    queryParam = params.querystring
  }
  // let body or bulkBody override querystring, as some requests have both
  if (isNotEmpty(params.body)) {
    queryParam = params.body
  } else if (Array.isArray(params.bulkBody) && params.bulkBody.length) {
    queryParam = params.bulkBody
  }

  const query = JSON.stringify(queryParam)

  return {
    collection,
    operation,
    query
  }
}

/**
 * Convenience function for parsing the params.path sent to the queryParser
 * for normalized collection and operation
 *
 * @param {string} pathString params.path supplied to the query parser
 * @param {string} method http method called by @elastic/elasticsearch
 * @returns {object} consisting of collection {string} and operation {string}
 */
function parsePath(pathString, method) {
  let collection
  let operation
  const defaultCollection = 'any'
  const actions = {
    GET: 'get',
    PUT: 'create',
    POST: 'create',
    DELETE: 'delete',
    HEAD: 'exists'
  }
  const suffix = actions[method]

  try {
    const path = pathString.split('/')
    if (method === 'PUT' && path.length === 2) {
      collection = path?.[1] || defaultCollection
      operation = `index.create`
      return { collection, operation }
    }
    path.forEach((segment, idx) => {
      const prev = idx - 1
      let opname
      if (segment === '_search') {
        collection = path?.[prev] || defaultCollection
        operation = `search`
      } else if (segment[0] === '_') {
        opname = segment.substring(1)
        collection = path?.[prev] || defaultCollection
        operation = `${opname}.${suffix}`
      }
    })
    if (!operation && !collection) {
      // likely creating an index--no underscore segments
      collection = path?.[1] || defaultCollection
      operation = `index.${suffix}`
    }
  } catch (e) {
    logger.warn('Failed to parse path for operation and collection. Using defaults')
    logger.warn(e)
    collection = defaultCollection
    operation = 'unknown'
  }

  return { collection, operation }
}

/**
 * Convenience function for deriving connection information from
 * elasticsearch
 *
 * @param {object} shim The New Relic datastore-shim
 * @returns {Function} captureInstanceAttributes method of shim
 */
function getConnection(shim) {
  const connectionPool = this.connectionPool.connections[0]
  const host = connectionPool.url.host.split(':')
  const port = connectionPool.url.port || host?.[1]
  return shim.captureInstanceAttributes(host[0], port)
}

module.exports.queryParser = queryParser
module.exports.parsePath = parsePath
module.exports.getConnection = getConnection
