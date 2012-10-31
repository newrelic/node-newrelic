'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
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
  shimmer.wrapMethod(redis.RedisClient.prototype,
                     'redis.RedisClient.prototype',
                     'send_command',
                     function wrapper(original) {
    return agent.tracer.segmentProxy(function wrapped() {
      var state = agent.getState();
      if (!state || arguments.length < 1) return original.apply(this, arguments);

      var current = state.getSegment();

      var args = Array.prototype.slice.call(arguments);

      var name = 'Redis/' + (args[0] || 'Unknown');
      var segment = current.add(name, record);
      state.setSegment(segment);

      var position = args.length - 1;
      var last = args[position];

      var target;
      if (typeof last === 'function') {
        target = args[position];

        args[position] = agent.tracer.callbackProxy(function () {
          var returned = target.apply(this, arguments);
          segment.end();

          return returned;
        });
      }
      else if (Array.isArray(last) && typeof last[last.length - 1] === 'function') {
        target = last[last.length - 1];
        last[last.length - 1] = agent.tracer.callbackProxy(function () {
          var returned = target.apply(this, arguments);
          segment.end();

          return returned;
        });
      }
      else { // let's shove a callback in there for fun
        args.push(function () { segment.end(); });
      }

      return original.apply(this, args);
    });
  });
};
