
var newrelic = require('newrelic')

// ---------------------------- //
// ---                      --- //
// --- CASSANDRA IMPERATIVE --- //
// ---                      --- //
// ---------------------------- //

newrelic.instrument('cassandra-driver', function(shim, cassandra) {
  var proto = cassandra.Client.prototype

  shim.record(proto, '_innerExecute', function execRecordName(shim, innerExecute, _, args) {
    return recordSql(this.keyspace, args[0])
  })

  shim.record(proto, 'batch', function batchRecordName(shim, batch, _, args) {
    var sql = (args[0] && args[0][0]) || ''
    return recordSql(this.keyspace, sql.query || sql, '/batch')
  })

  shim.record(proto, ['connect', 'shutdown'], {
    metric: CASSANDRA.OPERATION,
    callback: -1
  })

  function recordSql(keyspace, sql, suffix) {
    var ps = parseSql(CASSANDRA.PREFIX, sql)
    return {
      name: getModel(keyspace, ps.model) + '/' + ps.operation + (suffix || ''),
      metric: CASSANDRA.STATEMENT,
      callback: -1
    }
  }

  function getModel(keyspace, model) {
    var mod = model || 'other'
    return (keyspace && mod.indexOf('.') === -1) ? (keyspace + '.' + mod) : mod
  }
})


// --------------------------- //
// ---                     --- //
// --- CASSANDRA DATASTORE --- //
// ---                     --- //
// --------------------------- //

newrelic.instrumentDatastore('cassandra-driver', function instrumenter(shim, cassandra) {
  var proto = cassandra.Client.prototype
  shim.setDatastore(shim.CASSANDRA)
  shim.recordOperation(proto, ['connect', 'shutdown'], {callback: shim.LAST})
  shim.recordQuery(proto, '_innerExecute', {query: shim.FIRST, callback: shim.LAST})
  shim.recordBatchQuery(proto, 'batch', {
    query: function(shim, batch, _, args) {
      var sql = (args[0] && args[0][0]) || ''
      return sql.query || sql
    },
    callback: shim.LAST
  })
})


// ----------------------- //
// ---                 --- //
// --- REDIS DATASTORE --- //
// ---                 --- //
// ----------------------- //

newrelic.instrumentDatastore('redis', function instrumenter(shim, redis) {
  var proto = redis && redis.RedisClient && redis.RedisClient.prototype
  if (!proto) {
    return
  }

  shim.setDatastore(shim.REDIS)
  shim.operation(proto, 'send_command', function(shim, send_command, _, args) {
    var extras = {
      host: this.host,
      port: this.port
    }
    var keys = args[1]
    if (keys && !shim.isFunction(keys)) {
      extras.parameters = {key: shim.stringify(keys[0], 'unknown')}
    }

    return {
      name: args[0] || 'other',
      extras: extras,
      callback: function(shim, _f, _n, segment) {
        var last = args[args.length - 1]
        if (shim.isFunction(last)) {
          shim.bindCallbackSegment(args, shim.LAST, segment)
        }
        else if (shim.isArray(last) && shim.isFunction(last[last.length - 1])) {
          shim.bindCallbackSegment(last, shim.LAST, segment)
        }
      }
    }
  })
})

// ----------------------- //
// ---                 --- //
// --- MYSQL DATASTORE --- //
// ---                 --- //
// ----------------------- //

newrelic.instrumentDatastore('mysql', function instrumenter(shim, mysql) {
  shim.setDatastore(shim.MYSQL)

  shim.wrapReturn(mysql, 'createConnection', wrapQueriable)

  shim.wrapReturn(mysql, 'createPool', function(shim, pool) {
    shim.wrap(pool, 'getConnection', wrapGetConnection)
    wrapQueriable(shim, pool)
  })

  shim.wrapReturn(mysql, 'createPoolCluster', function(shim, poolCluster) {
    shim.wrap(poolCluster, 'getConnection', wrapGetConnection)
    shim.wrapReturn(poolCluster, 'of', function(shim, ofCluster) {
      shim.wrap(ofCluster, 'getConnection', wrapGetConnection)
    })
  })

  function wrapQueriable(shim, queriable) {
    if (!queriable || !queriable.query || shim.isWrapped(queriable.query)) {
      return
    }

    shim.query(queriable, 'query', function(shim, _f, _n, args) {
      var query = ''
      var callback = null

      if (args.length == 1 && shim.isObject(args)) {
        // queriable.query(options)
        callback = function(shim, __f, __n, segment) {
          shim.bindCallbackSegment(args[0], '_callback', segment)
        }
        query = args[0].sql
      }
      else if (args.length == 1) {
        // queriable.query(callback)
        // queriable.query(sql)
        if (shim.isFunction(args[0])) {
          callback = 0
        }
        else {
          query = args[0]
        }
      }
      else if (args.length == 2) {
        // queriable.query(sql, callback)
        // queriable.query(sql, values)
        query = args[0]
        if (shim.isFunction(args[1])) {
          callback = 1
        }
      }
      else {
        // queriable.query(sql, values, callback)
        query = args[0]
        if (shim.isFunction(args[2])) {
          callback = 2
        }
      }

      var extras = {}
      var conf = queriable.config
      conf = (conf && conf.connectionConfig) || conf
      if (conf) {
        extras.host = conf.host
        extras.port = conf.port
      }

      return {
        stream: true
        query: query,
        callback: callback
        extras: extras
      }
    })
  }

  function wrapGetConnection(shim, getConnection) {
    return function wrappedGetConnection() {
      var args = shim.toArray(arguments)
      shim.wrap(args, args.length - 1, function(shim, cb) {
        return function(err, conn) {
          wrapQueriable(shim, conn)
          return cb.apply(this, arguments)
        }
      })
      return getConnection.apply(this, args)
    }
  }
})
