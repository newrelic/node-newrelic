/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const dbutils = require('../../db/utils')
const properties = require('../../util/properties')
const symbols = require('../../symbols')

function callbackInitialize(shim, mysql) {
  shim.setDatastore(shim.MYSQL)
  shim[symbols.wrappedPoolConnection] = false

  shim.wrapReturn(mysql, 'createConnection', wrapCreateConnection)
  function wrapCreateConnection(shim, fn, fnName, connection) {
    if (shim[symbols.unwrapConnection]) {
      return
    }
    shim.logger.debug('Wrapping Connection#query')
    if (wrapQueryable(shim, connection, false)) {
      const connProto = Object.getPrototypeOf(connection)
      connProto[symbols.storeDatabase] = true
      shim[symbols.unwrapConnection] = true
    }
  }

  shim.wrapReturn(mysql, 'createPool', wrapCreatePool)
  function wrapCreatePool(shim, fn, fnName, pool) {
    if (shim[symbols.unwrapPool]) {
      return
    }
    shim.logger.debug('Wrapping Pool#query and Pool#getConnection')
    if (wrapQueryable(shim, pool, true) && wrapGetConnection(shim, pool)) {
      shim[symbols.unwrapPool] = true
    }
  }

  shim.wrapReturn(mysql, 'createPoolCluster', wrapCreatePoolCluster)
  function wrapCreatePoolCluster(shim, fn, fnName, poolCluster) {
    if (shim[symbols.createPoolCluster]) {
      return
    }
    shim.logger.debug('Wrapping PoolCluster#of')
    const proto = Object.getPrototypeOf(poolCluster)
    shim.wrapReturn(proto, 'of', wrapPoolClusterOf)
    function wrapPoolClusterOf(shim, of, _n, poolNamespace) {
      if (poolNamespace[symbols.clusterOf]) {
        return
      }

      if (wrapGetConnection(shim, poolNamespace) && wrapQueryable(shim, poolNamespace, false)) {
        poolNamespace[symbols.clusterOf] = true
      }
    }

    shim.logger.debug('Wrapping PoolCluster#getConnection')
    if (wrapGetConnection(shim, poolCluster)) {
      shim[symbols.createPoolCluster] = true
    }
  }
}

function promiseInitialize(shim) {
  const callbackAPI = shim.require('./index')
  if (callbackAPI && !shim.isWrapped(callbackAPI.createConnection)) {
    callbackInitialize(shim, callbackAPI)
  }
}

function wrapGetConnection(shim, connectable) {
  if (!connectable || !connectable.getConnection || shim.isWrapped(connectable.getConnection)) {
    shim.logger.trace(
      {
        connectable: !!connectable,
        getConnection: !!(connectable && connectable.getConnection),
        isWrapped: !!(connectable && shim.isWrapped(connectable.getConnection))
      },
      'Not wrapping getConnection'
    )
    return false
  }

  const proto = Object.getPrototypeOf(connectable)
  shim.wrap(proto, 'getConnection', function doWrapGetConnection(shim, fn) {
    return function wrappedGetConnection() {
      const args = shim.toArray(arguments)
      const cbIdx = args.length - 1

      // avoid an infinite loop and check both the cb and the "original" cb before re-wrapping
      // this is only applicable now with the security agent + us doing the same thing
      const original = shim.getOriginalOnce(args[cbIdx])
      if (
        shim.isFunction(args[cbIdx]) &&
        !(shim.isWrapped(args[cbIdx]) || shim.isWrapped(original))
      ) {
        shim.logger.trace(
          {
            hasSegment: !!shim.getSegment()
          },
          'Wrapping callback with segment'
        )
        let cb = args[cbIdx]
        if (!shim[symbols.wrappedPoolConnection]) {
          cb = shim.wrap(cb, wrapGetConnectionCallback)
        }
        args[cbIdx] = shim.bindSegment(cb)
      }
      return fn.apply(this, args)
    }
  })

  return true
}

function wrapGetConnectionCallback(shim, cb) {
  return function wrappedGetConnectionCallback(err, conn) {
    try {
      shim.logger.debug('Wrapping PoolConnection#query')
      if (!err && wrapQueryable(shim, conn, false)) {
        // Leave getConnection wrapped in order to maintain TX state, but we can
        // simplify the wrapping of its callback in future calls.
        shim[symbols.wrappedPoolConnection] = true
      }
    } catch (_err) {
      shim.logger.debug(
        { error: _err },
        'Attempt to wrap PoolConnection#query resulted in thrown error'
      )
    }
    return cb.apply(this, arguments)
  }
}

function wrapQueryable(shim, queryable, isPoolQuery) {
  if (!queryable || !queryable.query || shim.isWrapped(queryable.query)) {
    shim.logger.debug(
      {
        queryable: !!queryable,
        query: !!(queryable && queryable.query),
        isWrapped: !!(queryable && shim.isWrapped(queryable.query))
      },
      'Not wrapping queryable'
    )
    return false
  }

  const proto = Object.getPrototypeOf(queryable)

  let describe
  if (isPoolQuery) {
    describe = describePoolQuery
  } else {
    describe = describeQuery
    proto[symbols.databaseName] = null
  }

  shim.recordQuery(proto, 'query', describe)

  if (queryable.execute) {
    shim.recordQuery(proto, 'execute', describe)
  }

  return true
}

function extractQueryArgs(shim, args) {
  let query = ''
  let callback = null

  // Figure out the query parameter.
  if (shim.isString(args[0])) {
    // query(sql [, values], callback)
    query = args[0]
  } else {
    // query(opts [, values], callback)
    query = args[0].sql
  }

  // Then determine the query values and callback parameters.
  if (shim.isArray(args[1])) {
    // query({opts|sql}, values, callback)
    callback = 2
  } else {
    // query({opts|sql}, callback)
    callback = 1
  }

  return {
    query: query,
    callback: callback
  }
}

function describeQuery(shim, queryFn, fnName, args) {
  shim.logger.trace('Recording query')
  const extractedArgs = extractQueryArgs(shim, args)

  // Pull out instance attributes.
  const parameters = getInstanceParameters(shim, this, extractedArgs.query)

  shim.logger.trace(
    {
      query: !!extractedArgs.query,
      callback: !!extractedArgs.callback,
      parameters: !!parameters
    },
    'Query segment descriptor'
  )

  return {
    stream: true,
    query: extractedArgs.query,
    callback: extractedArgs.callback,
    parameters: parameters,
    record: true
  }
}

function describePoolQuery(shim, queryFn, fnName, args) {
  shim.logger.trace('Recording pool query')
  const extractedArgs = extractQueryArgs(shim, args)
  return {
    stream: true,
    query: null,
    callback: extractedArgs.callback,
    name: 'MySQL Pool#query',
    record: false
  }
}

function getInstanceParameters(shim, queryable, query) {
  const parameters = { host: null, port_path_or_id: null, database_name: null }
  let conf = queryable.config
  conf = (conf && conf.connectionConfig) || conf
  let databaseName = queryable[symbols.databaseName] || null
  if (conf) {
    parameters.database_name = databaseName = databaseName || conf.database

    if (properties.hasOwn(conf, 'socketPath') && conf.socketPath) {
      // In the unix domain socket case we force the host to be localhost
      parameters.host = 'localhost'
      parameters.port_path_or_id = conf.socketPath
    } else {
      parameters.host = conf.host
      parameters.port_path_or_id = conf.port
    }
  } else {
    shim.logger.trace('No query config detected, not collecting db instance data')
  }

  storeDatabaseName(queryable, query)
  return parameters
}

function storeDatabaseName(queryable, query) {
  if (queryable[symbols.storeDatabase]) {
    const databaseName = dbutils.extractDatabaseChangeFromUse(query)
    if (databaseName) {
      queryable[symbols.databaseName] = databaseName
    }
  }
}

module.exports = {
  callbackInitialize,
  promiseInitialize,
  wrapGetConnection,
  wrapGetConnectionCallback,
  wrapQueryable,
  extractQueryArgs,
  describeQuery,
  describePoolQuery,
  getInstanceParameters,
  storeDatabaseName
}
