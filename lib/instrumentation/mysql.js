'use strict'

var logger = require('../logger').child({component: 'mysql'})
var shimmer = require('../shimmer')
var parseSql = require('../db/parse-sql')
var MYSQL = require('../metrics/names').MYSQL

var DatastoreShim = require('../shim/datastore-shim')

module.exports = function initialize(agent, mysql, moduleName, shim) {
  shim.setDatastore(shim.MYSQL)

  shim.wrapReturn(mysql, 'createConnection', function(shim, fn, fnName, connection) {
    shim.logger.warn('Wrapping connection.query')
    if (wrapQueriable(shim, connection)) {
      shim.unwrap(mysql, 'createConnection')
    }
  })

  shim.wrapReturn(mysql, 'createPool', function(shim, fn, fnName, pool) {
    shim.logger.warn('Wrapping pool.query and pool.getConnection')
    if (wrapQueriable(shim, pool) && wrapGetConnection(shim, pool)) {
      shim.unwrap(mysql, 'createPool')
    }
  })

  shim.wrapReturn(mysql, 'createPoolCluster', function(shim, fn, fnName, poolCluster) {
    var proto = Object.getPrototypeOf(poolCluster)
    shim.wrapReturn(proto, 'of', function(_s, of, fnName, poolNamespace) {
      if (wrapGetConnection(shim, poolNamespace)) {
        shim.unwrap(proto, 'of')
      }
    })

    if (wrapGetConnection(shim, poolCluster)) {
      shim.unwrap(mysql, 'createPoolCluster')
    }
  })

  function wrapGetConnection(shim, connectable) {
    if (
      !connectable ||
      !connectable.getConnection ||
      shim.isWrapped(connectable.getConnection)
    ) {
      return false
    }

    var proto = Object.getPrototypeOf(connectable)
    shim.wrap(proto, 'getConnection', function(shim, fn, fnName) {
      return function wrappedGetConnection() {
        var args = shim.toArray(arguments)
        var cbIdx = args.length - 1
        if (shim.isFunction(args[cbIdx]) && !shim.isWrapped(args[cbIdx])) {
          shim.logger.warn('Wrapping callback with segment', !!shim.getSegment())
          var cb = args[cbIdx]
          args[cbIdx] = shim.bindSegment(function wrappedGetConnectionCallback(err, conn) {
            try {
              shim.logger.warn('Wrapping poolconnection.query')
              if (!err && wrapQueriable(shim, conn)) {
                shim.unwrap(proto, 'getConnection')
              }
            } catch (err) {
              shim.logger.debug(
                {error: err},
                'Attempt to wrap PoolConnection.query resulted in thrown error'
              )
            }
            return cb.apply(this, arguments)
          })
        }
        return fn.apply(this, args)
      }
    })

    return true
  }

  function wrapQueriable(shim, queriable) {
    shim.logger.warn(
      !!queriable,
      !!(queriable && queriable.query),
      (queriable && shim.isWrapped(queriable.query))
    )
    if (!queriable || !queriable.query || shim.isWrapped(queriable.query)) {
      shim.logger.warn('Not wrappying queriable')
      return false
    }

    var proto = Object.getPrototypeOf(queriable)
    shim.recordQuery(proto, 'query', wrapProtoQuery)
    return true
  }

  function wrapProtoQuery(shim, query, fnName, args) {
    shim.logger.warn('Recording query')

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

    shim.logger.warn(
      !!query,
      !!callback,
      !!values,
      !!extras
    )

    return {
      stream: true,
      query: query,
      callback: callback,
      values: values,
      extras: extras
    }
  }
}
