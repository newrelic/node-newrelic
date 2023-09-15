/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function initialize(_agent, elastic, _moduleName, shim) {
  shim.setDatastore(shim.ELASTICSEARCH)
  shim.setParser(queryParser)

  // cwd is node_modules/@elastic/elasticsearch w/ shim.require so use the relative path
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
  const method = params.method

  let operation = 'other'
  // the substance of the query may be in querystring or in body.
  let queryParam = {}
  if (typeof params.querystring === 'object' && Object.keys(params.querystring) > 0) {
    queryParam = params.querystring
  } else if (typeof params.body === 'object' && Object.keys(params.body).length > 0) {
    queryParam = params.body
  }

  let query = JSON.stringify(queryParam)?.replaceAll('"', '')
  if (path?.[2] === '_doc' && method === 'PUT') {
    operation = 'create'
  } else if (path?.[2] === '_doc' && method === 'DELETE') {
    operation = 'delete'
    query = `{ title: ${path?.[3]?.replaceAll('%20', ' ')} }`
  } else if (path?.[2] === '_search' && method === 'POST') {
    operation = 'search'
  }

  return {
    ...params,
    collection: path?.[1],
    database_name: path?.[1],
    operation,
    query
  }
}

function getConnection(shim) {
  // grab the first connection in the connection pool
  const connection = this.connectionPool.connections[0]
  const host = connection.url.host.split(':')
  const port = connection.url.port
  return shim.captureInstanceAttributes(host[0], port)
}

module.exports.queryParser = queryParser
module.exports.getConnection = getConnection
