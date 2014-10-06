'use strict'

var path     = require('path')
  , logger   = require('../logger').child({component : 'mysql'})
  , shimmer  = require('../shimmer')
  , parseSql = require('../db/parse-sql')
  , MYSQL    = require('../metrics/names').MYSQL
  

module.exports = function initialize(agent, mysql) {
  var tracer = agent.tracer

  function wrapQueriable(queriable, name) {
    // may not always be a 'queriable' object, but anything with a .query
    // you should pass the appropriate name in for shimmer
    shimmer.wrapMethod(queriable, name, 'query', function cb_wrapMethod(query) {
      return tracer.segmentProxy(function cb_segmentProxy(/* arguments */) {

        // the code below implicitly relies on a transaction,
        // so bail early if there is none
        //
        // we also avoid zero-argument calls
        if (!tracer.getTransaction() || arguments.length < 1) {
          logger.trace('not tracing because outside a transaction in %s', name)

          return query.apply(this, arguments)
        }

        var sqlString = ''
        var queryVals = []

        // these are used in the onEnd function
        var userCallback
          , segment
          

        // passed to .query
        // ends the segment, and then calls the user callback
        function onEnd(err) {
          logger.trace({error: err}, 'mysql query result in %s', name)

          var ret
          if (userCallback) ret = userCallback.apply(null, arguments)
          segment.end(); // !m wraithan

          return ret
        }

        function checkFunc(maybeFunc) {
          var out
          if (typeof maybeFunc === 'function') {
            out = tracer.callbackProxy(maybeFunc)
          }
          return out
        }

        // This is just a massive argument hunt
        // because you can call .query in many ways.
        //
        // You should populate `userCallback` after this block with a callback.
        // Optionally you may populate `queryVals` and `sqlString`.
        // The value in `sqlString` will show up in the UI
        var vargs = []

        if (arguments.length === 1 && typeof arguments[0] === 'object') {
          // .query(query)
          // query query is a Query object and contains ._callback and .sql
          userCallback = checkFunc(arguments[0]._callback)
          arguments[0]._callback = onEnd
          vargs.push(arguments[0])
        } else if (arguments.length === 1) {
          // either .query(callback) or .query(sql)
          // in the latter case we append our own callback for instrumentation
          if (!(userCallback = checkFunc(arguments[0]))) {
            vargs.push(arguments[0])
          }
          vargs.push(onEnd)
        } else if (arguments.length === 2) {
          // .query(sql, callback) or .query(sql, values)
          // in the latter case we append our own callback for instrumentation
          vargs.push(sqlString = arguments[0])
          if (!(userCallback = checkFunc(arguments[1]))) {
            vargs.push(arguments[1])
          }
          vargs.push(onEnd)
        } else {
          // .query(sql, values, callback) or unknown
          // in the latter case, we just omit measuring
          vargs.push(sqlString = arguments[0])
          vargs.push(queryVals = arguments[1])
          if (!(userCallback = checkFunc(arguments[2]))) {
            vargs.push(arguments[2])
          } else {
            vargs.push(onEnd)
          }
        }

        // name the metric
        var ps = parseSql(MYSQL.PREFIX, sqlString)
        var segmentName = MYSQL.STATEMENT + ps.model + '/' + ps.operation
        logger.trace({parsed: ps}, 'capturing sql in %s', name)

        // we will end the segment in onEnd above
        segment = tracer.addSegment(segmentName, ps.recordMetrics.bind(ps))

        if (this.config && this.config.connectionConfig) {
          segment.port = this.config.port || this.config.connectionConfig.port
          segment.host = this.config.host || this.config.connectionConfig.host
        }

        return query.apply(queriable, vargs)
      })

    })
  }

  function getVargs(args) {
    var callback

    var vargs = []
    if (args.length === 1) {
      callback = args[0]
    } else if (args.length === 2) {
      vargs.push(args[0])
      callback = args[1]
    } else {
      vargs.push(args[0])
      vargs.push(args[1])
      callback = args[2]
    }

    logger.trace({args: args, vargs: vargs}, 'parsed getConnection arguments')

    return {
      vargs    : vargs,
      callback : callback,
    }
  }

  function getConnectionHandler(dbObject, getConnectionMethod) {
    return function wrap_getConnection() { // getConnection
      var args = getVargs(arguments)
      var getConnectionCallback

      // let's verify that we actually have a callback,
      // otherwise we should just pass on wrapping it
      //
      // TODO: test case where no callback is supplied
      var isCallback = args.callback && typeof args.callback === 'function'

      // The mysql module has internal retry logic that will call
      // getConnection again with our wrapped callback.
      // We should avoid re-wrapping the callback when possible,
      // although nothing bad happens when we fail this, it just
      // makes stack traces a little better in errors.
      if (!isCallback || !args.callback.__NR_original_callback) {
        var proxiedCallback = tracer.callbackProxy(args.callback)
        getConnectionCallback = function getConnectionCallback(err, connection) {
          // we need to patch the connection objects .query method
          wrapQueriable(connection, 'connection')
          proxiedCallback(err, connection)
        }
        // tag so we can avoid re-wrapping
        getConnectionCallback.__NR_original_callback = args.callback
      } else {
        // the connection is already wrapped
        logger.trace('getConnection callback already wrapped')
        getConnectionCallback = args.callback
      }

      args.vargs.push(getConnectionCallback)

      return getConnectionMethod.apply(dbObject, args.vargs)
    }
  }

  // FIXME: need a more general way of differentiating between driver versions
  if (mysql && mysql.createConnection) {
    // congratulations, you have node-mysql 2.0

    // FLAG: mysql_pool
    if (agent.config &&
        agent.config.feature_flag &&
        agent.config.feature_flag.mysql_pool) {

    shimmer.wrapMethod(mysql, 'mysql.prototype', 'createPoolCluster',
    function cb_wrapMethod(createPoolCluster) {

      // this is generally called outside of a transaction,
      // so we don't need/care about preserving
      // the continuation, but we do need to patch the returned object
      return function not_in_transaction() {
        var poolCluster = createPoolCluster.apply(mysql, arguments)

        shimmer.wrapMethod(poolCluster, 'poolCluster', 'of',
        function cb_wrapMethod(of) {
          return function () {
            var ofCluster = of.apply(poolCluster, arguments)

            shimmer.wrapMethod(ofCluster, 'poolCluster', 'getConnection',
            function cb_wrapMethod(getConnection) {
              return getConnectionHandler(ofCluster, getConnection)
            })

            return ofCluster
          }
        })

        shimmer.wrapMethod(poolCluster, 'poolCluster', 'getConnection',
        function cb_wrapMethod(getConnection) {
          return getConnectionHandler(poolCluster, getConnection)
        })

        return poolCluster
      }
    })

    shimmer.wrapMethod(mysql, 'mysql', 'createPool',
    function cb_wrapMethod(createPool) {
      return function cb_segmentProxy() {
        var pool = createPool.apply(mysql, arguments)

        shimmer.wrapMethod(pool, 'pool', 'getConnection',
        function cb_wrapMethod(getConnection) {
          return getConnectionHandler(pool, getConnection)
        })

        // patch the pools .query method
        wrapQueriable(pool, 'pool')

        return pool
      }
    })

    } // FLAG: mysql_pool

    shimmer.wrapMethod(mysql, 'mysql', 'createConnection',
    function cb_wrapMethod(createConnection) {
      return tracer.segmentProxy(function cb_segmentProxy() {
        var connection = createConnection.apply(this, arguments)

        shimmer.wrapMethod(connection, 'connection', 'query',
        function cb_wrapMethod(query) {
          return tracer.segmentProxy(function cb_segmentProxy(sql, values, callback) {

            logger.trace("Potentially tracing node-mysql 2 query.")
            if (!tracer.getTransaction() || arguments.length < 1) {
              return query.apply(this, arguments)
            }
            var transaction = tracer.getTransaction()

            var actualSql, actualCallback, actualValues
            if (typeof sql === 'object') {
              // function (options, callback)
              actualSql = sql.sql
              actualCallback = values
            }
            else if (typeof values === 'function') {
              // function (sql, callback)
              actualSql = sql
              actualCallback = values
            }
            else {
              // function (sql, values, callback)
              actualSql = sql
              actualCallback = callback
              actualValues = values
            }

            var ps      = parseSql(MYSQL.PREFIX, actualSql)
              , wrapped = tracer.callbackProxy(actualCallback)
              , name    = MYSQL.STATEMENT + ps.model + '/' + ps.operation
              , segment = tracer.addSegment(name, ps.recordMetrics.bind(ps))
              

            // capture connection info for datastore instance metric
            if (this.config) {
              segment.port = this.config.port
              segment.host = this.config.host
            }

            logger.trace("Adding node-mysql 2 query trace segment on transaction %d.",
                         transaction.id)
            var returned = query.call(this, sql, actualValues, wrapped)
            returned.once('end', function handle_end() {
              segment.end()
              logger.trace("node-mysql 2 query finished for transaction %d.",
                           transaction.id)
            })

            return returned
          })
        })

        return connection
      })
    })
  }
  else if (mysql && mysql.Client) {
    // congratulations, you have node-mysql 0.9
    shimmer.wrapMethod(mysql && mysql.Client && mysql.Client.prototype,
                       'mysql.Client.prototype',
                       'query',
                       function cb_wrapMethod(query) {
      return tracer.segmentProxy(function cb_segmentProxy() {
        logger.trace("Potentially tracing node-mysql 0.9 query.")
        if (!tracer.getTransaction() || arguments.length < 1) {
          return query.apply(this, arguments)
        }
        var transaction = tracer.getTransaction()
        logger.trace("Tracing node-mysql 0.9 query on transaction %d.",
                     transaction.id)

        var args    = tracer.slice(arguments)
          , ps      = parseSql(MYSQL.PREFIX, args[0])
          , name    = MYSQL.STATEMENT + ps.model + '/' + ps.operation
          , segment = tracer.addSegment(name, ps.recordMetrics.bind(ps))
          

        // capture connection info for datastore instance metric
        segment.port = this.port
        segment.host = this.host

        // find and wrap the callback
        if (args.length > 1 && typeof(args[args.length - 1]) === 'function') {
          args[args.length - 1] = tracer.callbackProxy(args[args.length - 1])
        }

        // FIXME: need to grab error events as well, as they're also emitted on
        // the client

        var queried = query.apply(this, args)
        queried.once('end', function handle_end() {
          segment.end()
          logger.trace("node-mysql 0.9 query finished for transaction %d.",
                       transaction.id)
        })

        return queried
      })
    })
  }
}
