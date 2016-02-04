'use strict'

var logger = require('../logger').child({component: 'mysql'})
var shimmer = require('../shimmer')
var parseSql = require('../db/parse-sql')
var MYSQL = require('../metrics/names').MYSQL


module.exports = function initialize(agent, mysql) {
  var tracer = agent.tracer

  function wrapQueriable(queriable, name) {
    // may not always be a queriable object, but anything with a .query
    // you should pass the appropriate name in for shimmer
    if (!queriable) {
      return
    }

    shimmer.wrapMethod(
      queriable,
      name,
      'query',
      function nrQueryWrapper(original) {
        return tracer.wrapFunction(
          MYSQL.STATEMENT + 'Unknown',
          null,
          original,
          cb_wrapMethod,
          bindStreamingEvents
        )
      }
    )

    // we bind the streaming event emitters to track the query's
    // progress update the query's segment.
    function bindStreamingEvents(segment, queryObject) {
      queryObject.emit = tracer.bindFunction(queryObject.emit, segment, true)
      return queryObject
    }

    function cb_wrapMethod(segment, args, bind) {
      var sqlString = ''

      // This is just a massive argument hunt
      // because you can call .query in many ways.
      //
      // You should populate `userCallback` after this block with a callback.
      // Optionally you may populate `queryVals` and `sqlString`.
      // The value in `sqlString` will show up in the UI
      var vargs = []

      if (args.length === 1 && typeof args[0] === 'object') {
        // .query(query)
        // query query is a Query object and contains ._callback and .sql
        args[0]._callback = bind(args[0]._callback)
        sqlString = args[0].sql
        vargs.push(args[0])
      } else if (args.length === 1) {
        // either .query(callback) or .query(sql)
        // in the latter case we rely on the streaming interface
        if (typeof args[0] !== 'function') {
          sqlString = args[0].sql
          vargs.push(args[0])
        } else {
          vargs.push(bind(args[0]))
        }
      } else if (args.length === 2) {
        // .query(sql, callback) or .query(sql, values)
        // in the latter case we rely on the streaming interface
        vargs.push(sqlString = args[0])
        if (typeof args[1] !== 'function') {
          vargs.push(args[1])
        } else {
          vargs.push(bind(args[1]))
        }
      } else {
        // .query(sql, values, callback) or unknown
        // in the latter case, we just omit measuring
        vargs.push(sqlString = args[0])
        vargs.push(args[1])
        if (typeof args[2] !== 'function') {
          vargs.push(args[2])
          vargs.push(segment.touch.bind(segment))
        } else {
          vargs.push(bind(args[2]))
        }
      }


      // name the metric
      var ps = parseSql(MYSQL.PREFIX, sqlString)
      var model = ps.model
      var operation = ps.operation

      var segmentName = MYSQL.STATEMENT + (model || 'unknown') + '/' + operation
      logger.trace(
        'capturing mysql query in %s. model: %s, Operation: %s',
        name,
        model,
        operation
      )

      // we will end the segment in onEnd above
      tracer.getTransaction().addRecorder(ps.recordMetrics.bind(ps, segment))
      segment.name = segmentName

      if (queriable.config && queriable.config.connectionConfig) {
        segment.port = queriable.config.connectionConfig.port
        segment.host = queriable.config.connectionConfig.host
      } else if (queriable.config) {
        segment.port = queriable.config.port
        segment.host = queriable.config.host
      }

      return vargs
    }
  }

  function getVargs(args) {
    var callback

    var vargs = []

    switch (args.length) {
      case 1:
        callback = args[0]
        break
      case 2:
        vargs.push(args[0])
        callback = args[1]
        break
      default:
        vargs.push(args[0])
        vargs.push(args[1])
        callback = args[2]
        break
    }

    logger.trace({args: args, vargs: vargs}, 'parsed getConnection arguments')

    return {
      vargs: vargs,
      callback: callback
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
        var proxiedCallback = tracer.bindFunction(args.callback)
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

    shimmer.wrapMethod(mysql, 'mysql.prototype', 'createPoolCluster',
    function cb_wrapMethod(createPoolCluster) {
      // this is generally called outside of a transaction,
      // so we don't need/care about preserving
      // the continuation, but we do need to patch the returned object
      return function not_in_transaction() {
        var poolCluster = createPoolCluster.apply(mysql, arguments)

        shimmer.wrapMethod(poolCluster, 'poolCluster', 'of',
        function cb_wrapMethod(of) {
          return function nrWrappedMethod() {
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
      return function cb_wrapFunction() {
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

    shimmer.wrapMethod(
      mysql,
      'mysql',
      'createConnection',
      function cb_wrapMethod(createConnection) {
        return function wrappedCreateConnection() {
          var connection = createConnection.apply(this, arguments)
          wrapQueriable(connection, 'connection')
          return connection
        }
      }
    )
  } else if (mysql && mysql.Client) {
    // congratulations, you have node-mysql 0.9
    shimmer.wrapMethod(
      mysql && mysql.Client && mysql.Client.prototype,
      'mysql.Client.prototype',
      'query',
      function nrQueryWrapper(original) {
        return tracer.wrapFunction(
          MYSQL.STATEMENT + 'Unknown',
          null,
          original,
          wrapQuery09
        )
      }
    )
  }

  function wrapQuery09(segment, args, bind) {
    var transaction = tracer.getTransaction()

    var ps = parseSql(MYSQL.PREFIX, args[0])
    transaction.addRecorder(ps.recordMetrics.bind(ps, segment))
    segment.name = MYSQL.STATEMENT + (ps.model || 'unknown') + '/' + ps.operation


    // capture connection info for datastore instance metric
    segment.port = this.port
    segment.host = this.host

    // find and wrap the callback
    if (args.length > 1 && typeof args[args.length - 1] === 'function') {
      args[args.length - 1] = bind(args[args.length - 1])
    }

    // FIXME: need to grab error events as well, as they're also emitted on
    // the client

    return args
  }
}
