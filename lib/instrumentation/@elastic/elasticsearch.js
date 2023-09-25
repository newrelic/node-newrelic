/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../../logger').child({ component: 'ElasticSearch' })

module.exports = function initialize(_agent, elastic, _moduleName, shim) {
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

function queryParser(params) {
  params = JSON.parse(params)
  const path = params.path.split('/')
  const actions = {
    GET: 'get',
    PUT: 'update',
    POST: 'create',
    DELETE: 'delete',
    HEAD: 'exists'
  }
  const defaultCollection = 'any'
  let operation
  let collection

  const suffix = actions[params.method]
  try {
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

  // the substance of the query may be in querystring or in body.
  let queryParam = {}
  if (typeof params.querystring === 'object' && Object.keys(params.querystring).length > 0) {
    queryParam = params.querystring
  }
  // let body or bulkBody override querystring, as some requests have both
  if (typeof params.body === 'object' && Object.keys(params.body).length > 0) {
    queryParam = params.body
  } else if (typeof params.bulkBody === 'object' && Object.keys(params.bulkBody).length > 0) {
    queryParam = params.bulkBody
  }

  const query = JSON.stringify(queryParam)

  return {
    collection,
    operation,
    query
  }
}

function getConnection(shim) {
  const connectionPool = this.connectionPool.connections[0]
  const host = connectionPool.url.host.split(':')
  const port = connectionPool.url.port || host?.[1]
  return shim.captureInstanceAttributes(host[0], port)
}

module.exports.queryParser = queryParser
module.exports.getConnection = getConnection
