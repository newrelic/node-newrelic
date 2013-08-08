'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , logger  = require(path.join(__dirname, '..', 'logger')).child({component : 'redis'})
  , REDIS   = require(path.join(__dirname, '..', 'metrics', 'names')).REDIS
  ;

function record(segment, scope) {
  var duration    = segment.getDurationInMillis();
  var transaction = segment.trace.transaction;

  if (scope) transaction.measure(segment.name, scope, duration);

  transaction.measure(segment.name, null, duration);
  transaction.measure(REDIS.ALL,    null, duration);
  transaction.measure(REDIS.WEB,    null, duration);
}

module.exports = function initialize(agent, redis) {
  shimmer.wrapMethod(redis && redis.RedisClient && redis.RedisClient.prototype,
                     'redis.RedisClient.prototype',
                     'send_command',
                     function wrapper(send_command) {
    return agent.tracer.segmentProxy(function wrapped() {
      logger.trace("Potentially tracing Redis command.");
      var state = agent.getState();
      if (!state || arguments.length < 1) return send_command.apply(this, arguments);

      var current  = state.getSegment()
        , args     = Array.prototype.slice.call(arguments)
        , name     = REDIS.PREFIX + (args[0] || 'Unknown')
        , segment  = current.add(name, record)
        , position = args.length - 1
        , last     = args[position]
        ;

      if (args[1] && typeof args[1] !== 'function') {
        segment.parameters.key = JSON.stringify([args[1][0]]);
      }

      logger.trace("Adding Redis command trace segment transaction %d.",
                   state.getTransaction().id);
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
        args[position] = agent.tracer.callbackProxy(finalize(last));
      }
      else if (Array.isArray(last) &&
               typeof last[last.length - 1] === 'function') {
        var callback = finalize(last[last.length - 1]);
        last[last.length - 1] = agent.tracer.callbackProxy(callback);
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
