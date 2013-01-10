'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , logger  = require(path.join(__dirname, '..', 'logger')).child({component : 'redis'})
  ;

function record(segment, scope) {
  var duration    = segment.getDurationInMillis();
  var transaction = segment.trace.transaction;

  if (scope) transaction.measure(segment.name, scope, duration);

  transaction.measure(segment.name,   null, duration);
  transaction.measure('Redis/all',    null, duration);
  transaction.measure('Redis/allWeb', null, duration);
}

module.exports = function initialize(agent, redis) {
  if (redis && redis.RedisClient) {
    shimmer.wrapMethod(redis.RedisClient.prototype,
                       'redis.RedisClient.prototype',
                       'send_command',
                       function wrapper(send_command) {
      return agent.tracer.segmentProxy(function wrapped() {
        logger.trace("Potentially tracing Redis command.");
        var state = agent.getState();
        if (!state || arguments.length < 1) return send_command.apply(this, arguments);

        var current = state.getSegment();

        var args = Array.prototype.slice.call(arguments);

        var name = 'Redis/' + (args[0] || 'Unknown');
        var segment = current.add(name, record);
        logger.trace("Adding Redis command trace segment transaction %d.",
                     state.getTransaction().id);
        state.setSegment(segment);

        var position = args.length - 1;
        var last = args[position];

        var target;
        var finalize = function () {
          var returned = target.apply(this, arguments);
          segment.end();
          logger.trace("Redis command trace segment ended for transaction %d.",
                       state.getTransaction().id);

          return returned;
        };

        if (typeof last === 'function') {
          target = args[position];
          args[position] = agent.tracer.callbackProxy(finalize);
        }
        else if (Array.isArray(last) && typeof last[last.length - 1] === 'function') {
          target = last[last.length - 1];
          last[last.length - 1] = agent.tracer.callbackProxy(finalize);
        }
        else { // let's shove a callback in there for fun
          args.push(function () {
            segment.end();
            logger.trace("Redis command trace segment ended for transaction %d.", state.getTransaction().id);
          });
        }

        return send_command.apply(this, args);
      });
    });
  }
  else {
    logger.debug("Passed a Redis module with no RedisClient, not patching.");
  }
};
