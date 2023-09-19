/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

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
  let operation = params.method
  let collection = path?.[1] || 'other'

  // if there's no specified index, the second path element is the operation
  if (collection[0] === '_') {
    operation = collection
    collection = 'other' // presumably search of all indices
  }

  // the substance of the query may be in querystring or in body.
  let queryParam = {}
  if (typeof params.querystring === 'object' && Object.keys(params.querystring) > 0) {
    queryParam = params.querystring
  } else if (typeof params.body === 'object' && Object.keys(params.body).length > 0) {
    queryParam = params.body
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
