'use strict'

var stringifySync = require('../util/safe-json').stringifySync
var shimmer = require('../shimmer')
var urltils = require('../util/urltils.js')
var recordRedis = require('../metrics/recorders/redis.js')
var REDIS = require('../metrics/names').REDIS


module.exports = function initialize(agent, redis) {
  var tracer = agent.tracer

  shimmer.wrapMethod(
    redis && redis.prototype,
    'redis.prototype',
    'sendCommand',
    function wrapSendCommand(original) {
      return tracer.wrapFunction(
        REDIS.OPERATION + 'Unknown',
        recordRedis,
        original,
        wrapper
      )
    }
  )

  function wrapper(segment, args, bind) {
    segment.name = REDIS.OPERATION + (args[0].name || 'unknown')
    if (args[0].args && typeof args[0].args !== 'function') {
      urltils.copyParameters(agent.config,
        {key: stringifySync(args[0].args[0], 'Unknown')}, segment.parameters)
    }

    // capture connection info for datastore instance metric
    segment.port = this.connector.options.port
    segment.host = this.connector.options.host
    args[0].promise._then = (function(promise, original){
      return function(){
        if (typeof arguments[0] === 'function') {
          arguments[0] = bind(arguments[0], true, true)
        }
        if (typeof arguments[1] === 'function') {
          arguments[1] = bind(arguments[1], true, true)
        }
        return original.apply(promise, arguments)
      }
    })(args[0].promise, args[0].promise._then)

    return args
  }
}
