'use strict'

var shimmer     = require('../shimmer')
  , logger      = require('../logger')
                    .child({component : 'cassandra-driver'})
  , record      = require('../metrics/recorders/cassandra.js')
  , parseSql    = require('../db/parse-sql')
  , CASSANDRA   = require('../metrics/names').CASSANDRA


var INSTRUMENTED_OPERATIONS = [
  'execute',
  'batch',
  'eachRow'
]

module.exports = function initialize(agent, cassandra) {
  var tracer = agent.tracer

  INSTRUMENTED_OPERATIONS.forEach(function cb_forEach(operation) {
    shimmer.wrapMethod(cassandra && cassandra.Client && cassandra.Client.prototype,
      'cassandra-driver.Client.prototype',
      operation,
      function wrapper(cmd) {
        return tracer.segmentProxy(function wrapped(queries) {
          if (!tracer.getTransaction() || arguments.length < 1) {
            logger.trace("Not tracing cassandra-driver command due to no transaction state.")
            return cmd.apply(this, arguments)
          }

          var transaction = tracer.getTransaction()
            , args = tracer.slice(arguments)
            , query = typeof queries === 'string' ? queries : queries[0]
            , ps = parseSql(CASSANDRA.PREFIX, query)
            , name = CASSANDRA.STATEMENT + this.keyspace + '.' + ps.model + '/' + ps.operation
            , segment = tracer.addSegment(name, record)
            , position = args.length - 1
            , last = args[position]


          logger.trace("Adding cassandra-driver command trace segment transaction %s.",
            transaction.id)

          // capture connection info for datastore instance metric
          segment.port = this.port
          segment.host = this.host

          function finalize(target) {
            return function cls_finalize() {
              var returned = target.apply(this, arguments)
              segment.end()
              logger.trace("cassandra-driver command trace segment ended for transaction %s.",
                transaction.id)

              return returned
            }
          }

          if (typeof last === 'function') {
            args[position] = tracer.callbackProxy(finalize(last))
          }
          else if (Array.isArray(last) && typeof last[last.length - 1] === 'function') {
            var callback = finalize(last[last.length - 1])
            last[last.length - 1] = tracer.callbackProxy(callback)
          }
          else { // let's shove a callback in there for fun
            args.push(function cb_push() {
              segment.end()
              logger.trace("cassandra-driver command trace segment ended for transaction %s.",
                transaction.id)
            })
          }

          return cmd.apply(this, args)
        })
      })
  })
}
