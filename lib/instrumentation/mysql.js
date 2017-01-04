'use strict'

var dbutils = require('../db/utils')

module.exports = function initialize(agent, mysql, moduleName, shim) {
  shim.setDatastore(shim.MYSQL)
  shim.__wrappedPoolConnection = false

  shim.wrapReturn(mysql, 'createConnection', wrapCreateConnection)
  function wrapCreateConnection(shim, fn, fnName, connection) {
    shim.logger.debug('Wrapping Connection#query')
    if (wrapQueriable(shim, connection, false)) {
      var connProto = Object.getPrototypeOf(connection)
      shim.setInternalProperty(connProto, '__NR_storeDatabase', true)
      shim.unwrap(mysql, 'createConnection')
    }
  }

  shim.wrapReturn(mysql, 'createPool', wrapCreatePool)
  function wrapCreatePool(shim, fn, fnName, pool) {
    shim.logger.debug('Wrapping Pool#query and Pool#getConnection')
    if (wrapQueriable(shim, pool, true) && wrapGetConnection(shim, pool)) {
      shim.unwrap(mysql, 'createPool')
    }
  }

  shim.wrapReturn(mysql, 'createPoolCluster', wrapCreatePoolCluster)
  function wrapCreatePoolCluster(shim, fn, fnName, poolCluster) {
    shim.logger.debug('Wrapping PoolCluster#of')
    var proto = Object.getPrototypeOf(poolCluster)
    shim.wrapReturn(proto, 'of', wrapPoolClusterOf)
    function wrapPoolClusterOf(shim, of, _n, poolNamespace) {
      if (wrapGetConnection(shim, poolNamespace)) {
        shim.unwrap(proto, 'of')
      }
    }

    shim.logger.debug('Wrapping PoolCluster#getConnection')
    if (wrapGetConnection(shim, poolCluster)) {
      shim.unwrap(mysql, 'createPoolCluster')
    }
  }
}

function wrapGetConnection(shim, connectable) {
  if (
    !connectable ||
    !connectable.getConnection ||
    shim.isWrapped(connectable.getConnection)
  ) {
    shim.logger.trace({
      connectable: !!connectable,
      getConnection: !!(connectable && connectable.getConnection),
      isWrapped: !!(connectable && shim.isWrapped(connectable.getConnection))
    }, 'Not wrapping getConnection')
    return false
  }

  var proto = Object.getPrototypeOf(connectable)
  shim.wrap(proto, 'getConnection', function doWrapGetConnection(shim, fn) {
    return function wrappedGetConnection() {
      var args = shim.toArray(arguments)
      var cbIdx = args.length - 1

      if (shim.isFunction(args[cbIdx]) && !shim.isWrapped(args[cbIdx])) {
        shim.logger.trace({
          hasSegment: !!shim.getSegment()
        }, 'Wrapping callback with segment')
        var cb = args[cbIdx]
        if (!shim.__wrappedPoolConnection) {
          cb = wrapGetConnectionCallback(shim, cb)
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
      if (!err && wrapQueriable(shim, conn, false)) {
        // Leave getConnection wrapped in order to maintain TX state, but we can
        // simplify the wrapping of its callback in future calls.
        shim.__wrappedPoolConnection = true
      }
    } catch (_err) {
      shim.logger.debug(
        {error: _err},
        'Attempt to wrap PoolConnection#query resulted in thrown error'
      )
    }
    return cb.apply(this, arguments)
  }
}

function wrapQueriable(shim, queriable, isPoolQuery) {
  if (!queriable || !queriable.query || shim.isWrapped(queriable.query)) {
    shim.logger.debug({
      queriable: !!queriable,
      query: !!(queriable && queriable.query),
      isWrapped: !!(queriable && shim.isWrapped(queriable.query))
    }, 'Not wrappying queriable')
    return false
  }

  var proto = Object.getPrototypeOf(queriable)
  if (isPoolQuery) {
    shim.recordQuery(proto, 'query', describePoolQuery)
  } else {
    shim.recordQuery(proto, 'query', describeQuery)
    shim.setInternalProperty(proto, '__NR_databaseName', null)
  }

  return true
}

function extractQueryArgs(shim, args) {
  var query = ''
  var values = null
  var callback = null

  // Figure out the query parameter.
  if (shim.isString(args[0])) {
    // query(sql [, values], callback)
    query = args[0]
  } else {
    // query(opts [, values], callback)
    query = args[0].sql
    values = args[0].values
  }

  // Then determine the query values and callback parameters.
  if (shim.isArray(args[1])) {
    // query({opts|sql}, values, callback)
    values = args[1]
    callback = 2
  } else {
    // query({opts|sql}, callback)
    callback = 1
  }

  return {
    query: query,
    values: values,
    callback: callback
  }
}

function describeQuery(shim, queryFn, fnName, args) {
  shim.logger.trace('Recording query')
  var extractedArgs = extractQueryArgs(shim, args)

  // Pull out instance attributes.
  var extras = getInstanceExtras(shim, this, extractedArgs.query)

  shim.logger.trace({
    query: !!extractedArgs.query,
    callback: !!extractedArgs.callback,
    values: !!extractedArgs.values,
    extras: !!extras
  }, 'Query segment descriptor')

  return {
    stream: true,
    query: extractedArgs.query,
    callback: extractedArgs.callback,
    values: extractedArgs.values,
    extras: extras,
    record: true
  }
}

function describePoolQuery(shim, queryFn, fnName, args) {
  shim.logger.trace('Recording pool query')
  var extractedArgs = extractQueryArgs(shim, args)
  return {
    stream: true,
    query: null,
    callback: extractedArgs.callback,
    values: null,
    name: 'MySQL Pool#query',
    record: false
  }
}

function getInstanceExtras(shim, queryable, query) {
  var extras = {host: null, port_path_or_id: null, database_name: null}
  var conf = queryable.config
  conf = (conf && conf.connectionConfig) || conf
  var databaseName = queryable.__NR_databaseName || null
  if (conf) {
    extras.database_name = databaseName = databaseName || conf.database

    if (conf.hasOwnProperty('socketPath') && conf.socketPath) {
      // In the unix domain socket case we force the host to be localhost
      extras.host = 'localhost'
      extras.port_path_or_id = conf.socketPath
    } else {
      extras.host = conf.host
      extras.port_path_or_id = conf.port
    }
  } else {
    shim.logger.trace('No query config detected, not collecting db instance data')
  }

  storeDatabaseName(shim, queryable, query)
  return extras
}

function storeDatabaseName(shim, queryable, query) {
  if (queryable.__NR_storeDatabase) {
    var databaseName = dbutils.extractDatabaseChangeFromUse(query)
    if (databaseName) {
      shim.setInternalProperty(queryable, '__NR_databaseName', databaseName)
    }
  }
}
