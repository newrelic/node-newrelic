/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function initialize(_agent, elastic, _moduleName, shim) {
  shim.setDatastore(shim.ELASTICSEARCH)
  shim.setParser(queryParser)

  // cwd is node_modules/@elastic/elasticsearch w/ shim.require so use the relative path
  const Transport = elastic.Transport
  record(shim, Transport.prototype, 'connect', getConnection) // 'request'
}

function record(shim, proto, cmd, inContextMethod) {
  shim.recordQuery(proto, cmd, function wrapQuery(shim, _, __, args) {
    const ctx = this
    return {
      query: JSON.stringify(args?.[0]),
      promise: true,
      inContext: function inContext() {
        inContextMethod(shim).bind(ctx)
      }
    }
  })
}

function queryParser(params) {
  params = JSON.parse(params)
  const path = params.path.split('/')
  const method = params.method

  let operation = 'other'
  let query = JSON.stringify(params?.body)?.replaceAll('"', '')
  if (path?.[2] === '_doc' && method === 'PUT') {
    operation = 'create'
  } else if (path?.[2] === '_doc' && method === 'DELETE') {
    operation = 'delete'
    query = `{ title: ${path?.[3]?.replaceAll('%20', ' ')} }`
  } else if (path?.[2] === '_search' && method === 'POST') {
    operation = 'search'
  }

  return {
    collection: path?.[1],
    operation,
    query
  }
}

function getConnection(shim) {
  // simply grab the first connection in the connection pool
  const connection = this.connectionPool.connections[0]
  const url = connection.url.toString()
  const port = url.match(/:(\d+)/)[1]
  return shim.captureInstanceAttributes(connection.url.toString(), port)
}

module.exports.queryParser = queryParser
module.exports.getConnection = getConnection
