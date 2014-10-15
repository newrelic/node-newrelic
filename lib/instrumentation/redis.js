'use strict'

var shimmer     = require('../shimmer')
  , logger      = require('../logger')
                    .child({component : 'redis'})
  , recordRedis = require('../metrics/recorders/redis.js')
  , REDIS       = require('../metrics/names').REDIS


module.exports = function initialize(agent, redis) {
  var tracer = agent.tracer

  shimmer.wrapMethod(redis && redis.RedisClient && redis.RedisClient.prototype,
                     'redis.RedisClient.prototype',
                     'send_command',
                     function wrapper(send_command) {
    return tracer.segmentProxy(function wrapped() {
      if (!tracer.getTransaction() || arguments.length < 1) {
        logger.trace("Not tracing Redis command due to no transaction state.")
        return send_command.apply(this, arguments)
      }

      var transaction = tracer.getTransaction()
        , args        = tracer.slice(arguments)
        , name        = REDIS.OPERATION + (args[0] || 'unknown')
        , segment     = tracer.addSegment(name, recordRedis)
        , position    = args.length - 1
        , keys        = args[1]
        , last        = args[position]


      if (agent.config.capture_params &&
          keys && typeof keys !== 'function' &&
          agent.config.ignored_params.indexOf('key') === -1) {
        segment.parameters.key = JSON.stringify([keys[0]])
      }

      logger.trace("Adding Redis command trace segment transaction %s.",
                   transaction.id)

      // capture connection info for datastore instance metric
      segment.port = this.port
      segment.host = this.host

      function finalize(target) {
        return function cls_finalize() {
          var returned = target.apply(this, arguments)
          segment.end()
          logger.trace("Redis command trace segment ended for transaction %s.",
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
          logger.trace("Redis command trace segment ended for transaction %s.",
                       transaction.id)
        })
      }

      return send_command.apply(this, args)
    })
  })
}
