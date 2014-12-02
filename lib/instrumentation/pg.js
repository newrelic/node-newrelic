'use strict'

var shimmer     = require('../shimmer')
  , logger      = require('../logger')
                    .child({component : 'pg'})
  , parseSql = require('../db/parse-sql')
  , POSTGRES  = require('../metrics/names').POSTGRES


// Adds a segment
// The `config` argument is either a statement string template or a pg statement
// config object with a `text` property holding the statement string template.
function addSegment(tracer, config) {
  var statement
  if (config && (typeof config === 'string' || config instanceof String)) statement = config
  else if (config && config.hasOwnProperty('text')) statement = config.text
  else statement = 'Other'; // Won't be matched by parser, but should be handled properly

  var ps = parseSql(POSTGRES.PREFIX, statement)
  var segmentName = POSTGRES.STATEMENT + ps.model + '/' + ps.operation
  logger.trace({parsed: ps}, 'capturing postgresql')

  return tracer.addSegment(segmentName, ps.recordMetrics.bind(ps))
}

module.exports = function initialize(agent, pgsql) {
  var tracer = agent.tracer

  //allows for native wrapping to not happen if not necessary

  //when env var is true
  if (process.env.NODE_PG_FORCE_NATIVE) {
    instrumentPGNative('pg', pgsql)
  }

  //using ('pg').native in their require
  else {
    var origGetter = pgsql.__lookupGetter__('native')
    delete pgsql.native
    pgsql.__defineGetter__('native', function() {
      var temp = origGetter()
      instrumentPGNative('pg.native', pgsql.native)
      return temp
    })
  }


  //wrapping for native
  function instrumentPGNative(eng, pg) {
    var constructors = [
        {english: eng, nodule: pg},
        {english: eng + '.pools', nodule: pg.pools}
      ]

    constructors.forEach(function cb_forEach(obj) {
      shimmer.wrapMethod(obj.nodule, obj.english, 'Client', function wrapper(client) {
        return function wrapClient() {
          var connection = client.apply(this, arguments)

          shimmer.wrapMethod(connection, 'Connection', 'connect', function conn_wrapper(connect) {
            return function wrapConnect(callback) {
              if (typeof callback === 'function') {
                callback =  tracer.callbackProxy(callback)
              }
              return connect.call(this, callback)
            }
          })

          shimmer.wrapMethod(connection, 'Connection', 'query', function query_wrapper(query) {
            return function wrapQuery() {

              if (!tracer.getTransaction() || arguments.length < 1) {
                logger.trace("Not tracing postgres command due to no transaction state.")
                return query.apply(this, arguments)
              }

              var transaction = tracer.getTransaction()
                , segment     = addSegment(tracer, arguments[0])
                , args        = tracer.slice(arguments)
                , pos         = args.length - 1
                , last        = args[pos]

              logger.trace("Adding postgres command trace segment transaction %s.",
                           transaction.id)

              // capture connection info for datastore instance metric
              segment.host = connection.host
              segment.port = connection.port

              // Proxy callback in case they start new segments
              if (typeof last === 'function') {
                args[pos] = tracer.callbackProxy(function cb_pgquery() {
                  last.apply(this, arguments)
                  segment.end()
                  logger.trace("postgres command trace segment ended by callback for transaction %s.",
                               transaction.id)
                })
              }

              // Wrap end and error events too, in case they start new segments within
              // them
              var res = query.apply(this, args)

              // Use end and error events to end segments
              var end = tracer.callbackProxy(function end() {
                segment.end()
                logger.trace("postgres command trace segment ended by event for transaction %s.",
                             transaction.id)
              })

              res.on('error', end)
              res.on('end', end)

              // Proxy events too, in case they start new segments within handlers
              shimmer.wrapMethod(res, 'query.on', 'on', function queryOnWrapper(on) {
                return tracer.callbackProxy(function queryOnWrapped() {
                  if (arguments[1]) arguments[1] = tracer.callbackProxy(arguments[1])
                  return on.apply(this, arguments)
                })
              })

              shimmer.wrapMethod(res, 'query.addListener', 'addListener', function queryAddLWrapper(addL) {
                return tracer.callbackProxy(function queryAddLWrapped() {
                  if (arguments[1]) arguments[1] = tracer.callbackProxy(arguments[1])
                  addL.apply(this, arguments)
                })
              })

              return res
            }
          })

          return connection
        }
      })
    })
  }



  //wrapping for JS
  shimmer.wrapMethod(pgsql && pgsql.Client && pgsql.Client.prototype, 'pg.Client.prototype', 'query', function wrapper(cmd) {
    return tracer.segmentProxy(function wrapped() {
      if (!tracer.getTransaction() || arguments.length < 1) {
        logger.trace("Not tracing postgres command due to no transaction state.")
        return cmd.apply(this, arguments)
      }

      var transaction = tracer.getTransaction()
        , segment = addSegment(tracer, arguments[0])
        , args = tracer.slice(arguments)
        , position = args.length - 1
        , last = args[position]


      logger.trace("Adding postgres command trace segment transaction %s.",
                   transaction.id)

      //TODO: capture connection info for datastore instance metric
      //segment.host = connection.host;
      //segment.port = connection.port;

      function finalize(target) {
        return function cls_finalize() {
          var returned = target.apply(this, arguments)
          segment.end()
          logger.trace("postgres command trace segment ended by callback for transaction %s.",
          transaction.id)

          return returned
        }
      }

      // Proxy callbacks in case they start new segments
      if (typeof last === 'function') {
        args[position] = tracer.callbackProxy(last)
      }
      else if (Array.isArray(last) && typeof last[last.length - 1] === 'function') {
        var callback = last[last.length - 1]
        last[last.length - 1] = tracer.callbackProxy(callback)
      }

      var query = cmd.apply(this, args)

      // Use end and error events to end segments
      var end = tracer.callbackProxy(function end() {
        segment.end()
        logger.trace("postgres command trace segment ended by event for transaction %s.",
                     transaction.id)
      })

      query.on('error', end)
      query.on('end', end)

      // Proxy events too, in case they start new segments within handlers
      shimmer.wrapMethod(query, 'query.on', 'on', function queryOnWrapper(on) {
        return tracer.callbackProxy(function queryOnWrapped() {
          if (arguments[1]) arguments[1] = tracer.callbackProxy(arguments[1])
          return on.apply(this, arguments)
        })
      })

      shimmer.wrapMethod(query, 'query.addListener', 'addListener', function queryAddLWrapper(addL) {
        return tracer.callbackProxy(function queryAddLWrapped() {
          if (arguments[1]) arguments[1] = tracer.callbackProxy(arguments[1])
          addL.apply(this, arguments)
        })
      })

      return query
    })
  })
}
