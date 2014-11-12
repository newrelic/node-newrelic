'use strict'

var shimmer     = require('../shimmer')
var logger      = require('../logger').child({component : 'redis'})
var recordRedis = require('../metrics/recorders/redis.js')
var REDIS       = require('../metrics/names').REDIS


module.exports = function initialize(agent, redis) {
  var tracer = agent.tracer

  shimmer.wrapMethod(
    redis && redis.RedisClient && redis.RedisClient.prototype,
    'redis.RedisClient.prototype',
    'send_command',
    function(original) {
      return tracer.wrapFunction(
        REDIS.OPERATION + 'Unknown',
        recordRedis,
        original,
        wrapper
      )
    }
  )

  function wrapper(segment, args, bind) {
    var transaction = segment.transaction
    var position = args.length - 1
    var keys = args[1]
    var last = args[position]

    segment.name = REDIS.OPERATION + (args[0] || 'unknown')

    if (agent.config.capture_params &&
        keys && typeof keys !== 'function' &&
        agent.config.ignored_params.indexOf('key') === -1) {
      segment.parameters.key = JSON.stringify([keys[0]])
    }

    logger.trace(
      'Adding Redis command trace segment transaction %s.',
      transaction.id
    )

    // capture connection info for datastore instance metric
    segment.port = this.port
    segment.host = this.host

    if (typeof last === 'function') {
      args[position] = bind(last, true, true)
    } else if (Array.isArray(last) && typeof last[last.length - 1] === 'function') {
      last[last.length - 1] = bind(last[last.length - 1], true, true)
    } else { // let's shove a callback in there for fun
      args.push(bind(null, true, true))
    }

    return args
  }
}
