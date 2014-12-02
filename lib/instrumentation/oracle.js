'use strict'

var logger = require('../logger').child({component: 'oracle'})
var shimmer = require('../shimmer')
var parseSql = require('../db/parse-sql')
var ORACLE = require('../metrics/names').ORACLE

function addSegment(tracer, sql, method) {
  var ps = parseSql(ORACLE.PREFIX, sql)
  var segmentName = ORACLE.STATEMENT + ps.model + '/'
  if(method) segmentName += method + '/'
  segmentName += ps.operation
  logger.trace({parsed: ps}, 'capturing oracle')

  return tracer.addSegment(segmentName, ps.recordMetrics.bind(ps))
}


module.exports = function initialize(agent, oracle) {
  var tracer = agent.tracer
  var wrapped = false

  logger.trace('wrapping oracle.connect and oracle.connectSync')

  shimmer.wrapMethod(oracle, 'Oracle', 'connect', function cb_wrapMethod(connect) {
    return function wrappedConnect(connectData, cb) {
      return connect.call(
        this,
        connectData,
        tracer.callbackProxy(wrapConnection)
      )

      function wrapConnection(err, connection) {
        if(!err) ensureConnectionWrapped(connection)
        return cb(err, connection)
      }
    }
  })

  shimmer.wrapMethod(oracle, 'Oracle', 'connectSync', function wrapSyncConnect(connect) {
    return function wrappedSyncConnect(connection) {
      var connection = connect.call(this, connectionData)
      ensureConnectionWrapped(connection)
      return connection
    }
  })

  function ensureConnectionWrapped(connection) {
    // return early in case called from an async connect after wrapping
    if(wrapped) return
    logger.trace('wrapping oracle connection prototype')
    wrapped = true
    var proto = Object.getPrototypeOf(connection)

    oracle.connectSync.__NR_unwrap()
    oracle.connect.__NR_unwrap()
    shimmer.wrapMethod(oracle, 'Oracle', 'connect', function wrapMethod(connect) {
      return function wrappedConnect(connectData, cb) {
        return connect.call(this, connectData, cb && tracer.callbackProxy(cb))
      }
    })

    var proto = Object.getPrototypeOf(connection)
    wrapExecute(proto, tracer)
    wrapPrepare(proto, tracer)

    shimmer.wrapMethod(proto, 'Oracle', 'reader', function wrapMethod(createReader) {
      return function wrappedConnect(sql, args) {
        var reader = createReader.call(this, sql, args)
        wrapReader(reader, tracer, sql)
        return reader
      }
    })
  }
}

function wrapExecute(connection, tracer) {
  shimmer.wrapMethod(connection, 'Oracle.connection', 'execute', function cb_wrapMethod(execute) {
    return tracer.segmentProxy(function cb_segmentProxy(sql, params, cb) {
      if (!tracer.getTransaction() || arguments.length < 1) {
        logger.trace('not tracing because outside a transaction in oracle')
        return execute.apply(this, arguments)
      }

      var transaction = tracer.getTransaction()
      var segment = addSegment(tracer, sql, 'Connection.execute')

      var end = function (err, response) {
        segment.end()
        logger.trace(
          'oracle command trace segment ended by event for transaction %s.',
          transaction.id
        )
        return cb(err, response)
      }

      end = tracer.callbackProxy(end)

      logger.trace(
        'Adding oracle command trace segment transaction %s.',
        transaction.id
      )
      return execute.call(this, sql, params, end)
    })
  })
}

function wrapReader(reader, tracer, sql) {
  shimmer.wrapMethod(reader, 'Oracle.Reader', 'nextRow', function cb_wrapMethod(nextRow) {
    return tracer.segmentProxy(function cb_segmentProxy(cb) {
      if (!tracer.getTransaction() || arguments.length < 1) {
        logger.trace('not tracing because outside a transaction in oracle')
        return nextRow.apply(this, arguments)
      }

      var transaction = tracer.getTransaction()
      var segment = addSegment(tracer, sql, 'Reader.nextRow')

      var wrapped_cb = function (err, row) {
        if (err) {
          return cb(err)
        }
        if (!row) {
          segment.end()
          logger.trace(
            'oracle command trace segment ended by event for transaction %s.',
            transaction.id
          )
          return cb(err, row)
        } else {
          segment.touch()
          return cb(err, row)
        }
      }

      wrapped_cb = tracer.callbackProxy(wrapped_cb)

      logger.trace(
        'Adding oracle command trace segment transaction %s.',
        transaction.id
      )
      return nextRow.call(this, wrapped_cb)
    })
  })

  shimmer.wrapMethod(reader, 'Oracle.Reader', 'nextRows', function cb_wrapMethod(nextRows) {
    return tracer.segmentProxy(function cb_segmentProxy(count, cb) {
      if (!tracer.getTransaction() || arguments.length < 1) {
        logger.trace('not tracing because outside a transaction in oracle')
        return nextRows.apply(this, arguments)
      }

      var transaction = tracer.getTransaction()
      var segment = addSegment(tracer, sql, 'Reader.nextRows')

      var wrapped_cb = function (err, rows) {
        if (err) {
          return cb(err)
        }
        if (!rows || !rows.length) {
          segment.end()
          logger.trace(
            'oracle command trace segment ended by event for transaction %s.',
            transaction.id
          )
          return cb(err, rows)
        } else {
          segment.touch()
          return cb(err, rows)
        }
      }

      wrapped_cb = tracer.callbackProxy(wrapped_cb)

      logger.trace(
        'Adding oracle command trace segment transaction %s.',
        transaction.id
      )
      return nextRows.call(this, wrapped_cb)
    })
  })
}

function wrapPrepare(connection, tracer) {
  shimmer.wrapMethod(connection, 'Oracle.connection', 'prepare', function cb_wrapMethod(prepare) {
    return function wrappedPrepare(sql) {
      var prepared = prepare.call(this, sql)

      shimmer.wrapMethod(prepared, 'Oracle', 'execute', function cb_wrapMethod(execute) {
        return tracer.segmentProxy(function cb_segmentProxy(params, cb) {
          var transaction = tracer.getTransaction()

          if (!transaction || arguments.length < 1) {
            logger.trace('not tracing because outside a transaction in oracle')
            return execute.call(this, params, cb)
          }

          var segment = addSegment(tracer, sql, 'Statement.execute')

          var wrapped_cb = tracer.callbackProxy(function cb_wrapper(err, response) {
            segment.end()
            logger.trace(
              'oracle command trace segment ended by event for transaction %s.',
              transaction.id
            )
            return cb(err, response)
          })

          return execute.call(this, params, wrapped_cb)
        })
      })

      return prepared
    }
  })
}
