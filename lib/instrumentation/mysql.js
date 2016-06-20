'use strict'

module.exports = function initialize(agent, mysql, moduleName, shim) {
  shim.setDatastore(shim.MYSQL)

  shim.wrapReturn(mysql, 'createConnection', wrapCreateConnection)
  function wrapCreateConnection(shim, fn, fnName, connection) {
    shim.logger.debug('Wrapping Connection#query')
    if (wrapQueriable(shim, connection)) {
      shim.unwrap(mysql, 'createConnection')
    }
  }

  shim.wrapReturn(mysql, 'createPool', wrapCreatePool)
  function wrapCreatePool(shim, fn, fnName, pool) {
    shim.logger.debug('Wrapping Pool#query and Pool#getConnection')
    if (wrapQueriable(shim, pool) && wrapGetConnection(shim, pool)) {
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
      if (!err && wrapQueriable(shim, conn)) {
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

function wrapQueriable(shim, queriable) {
  if (!queriable || !queriable.query || shim.isWrapped(queriable.query)) {
    shim.logger.debug({
      queriable: !!queriable,
      query: !!(queriable && queriable.query),
      isWrapped: !!(queriable && shim.isWrapped(queriable.query))
    }, 'Not wrappying queriable')
    return false
  }

  var proto = Object.getPrototypeOf(queriable)
  shim.recordQuery(proto, 'query', describeQuery)
  return true
}

function describeQuery(shim, query, fnName, args) {
  shim.logger.trace('Recording query')

  var query = ''
  var values = null
  var callback = null

  if (shim.isString(args[0])) {
    // query(sql [, values], callback)
    query = args[0]
  } else {
    // query(opts [, values], callback)
    query = args[0].sql
    values = args[0].values
  }

  if (shim.isArray(args[1])) {
    // query({opts|sql}, values, callback)
    values = args[1]
    callback = 2
  } else {
    // query({opts|sql}, callback)
    callback = 1
  }

  var extras = {}
  var conf = this.config
  conf = (conf && conf.connectionConfig) || conf
  if (conf) {
    extras.host = conf.host
    extras.port = conf.port
  }

  shim.logger.trace({
    query: !!query,
    callback: !!callback,
    values: !!values,
    extras: !!extras
  }, 'Query segment descriptor')

  return {
    stream: true,
    query: query,
    callback: callback,
    values: values,
    extras: extras
  }
}
