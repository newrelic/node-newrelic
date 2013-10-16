'use strict';

var path        = require('path')
  , shimmer     = require(path.join(__dirname, '..', 'shimmer'))
  , logger      = require(path.join(__dirname, '..', 'logger'))
                    .child({component : 'redis'})
  , recordRedis = require(path.join(__dirname, '..', 'metrics', 'recorders', 'redis.js'))
  , REDIS       = require(path.join(__dirname, '..', 'metrics', 'names')).REDIS
  ;

module.exports = function initialize(agent, redis) {
  var tracer = agent.tracer;

  shimmer.wrapMethod(redis && redis.RedisClient && redis.RedisClient.prototype,
                     'redis.RedisClient.prototype',
                     'send_command',
                     function wrapper(send_command) {
    return tracer.segmentProxy(function wrapped() {
      var state = tracer.getState();
      if (!state || arguments.length < 1) {
        logger.trace("Not tracing Redis command due to no transaction state.");
        return send_command.apply(this, arguments);
      }

      var args     = tracer.slice(arguments)
        , name     = REDIS.OPERATION + (args[0] || 'unknown')
        , segment  = state.getSegment().add(name, recordRedis)
        , position = args.length - 1
        , keys     = args[1]
        , last     = args[position]
        ;

      if (keys && typeof keys !== 'function') {
        segment.parameters.key = JSON.stringify([keys[0]]);
      }

      logger.trace("Adding Redis command trace segment transaction %d.",
                   state.getTransaction().id);

      // capture connection info for datastore instance metric
      segment.port = this.port;
      segment.host = this.host;

      state.setSegment(segment);

      function finalize(target) {
        return function () {
          var returned = target.apply(this, arguments);
          segment.end();
          logger.trace("Redis command trace segment ended for transaction %d.",
                       state.getTransaction().id);

          return returned;
        };
      }

      if (typeof last === 'function') {
        args[position] = tracer.callbackProxy(finalize(last));
      }
      else if (Array.isArray(last) && typeof last[last.length - 1] === 'function') {
        var callback = finalize(last[last.length - 1]);
        last[last.length - 1] = tracer.callbackProxy(callback);
      }
      else { // let's shove a callback in there for fun
        args.push(function () {
          segment.end();
          logger.trace("Redis command trace segment ended for transaction %d.",
                       state.getTransaction().id);
        });
      }

      return send_command.apply(this, args);
    });
  });
};
