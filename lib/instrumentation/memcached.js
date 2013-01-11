'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

function recordMemcacheMetrics(segment, scope) {
  var duration = segment.getDurationInMillis();
  var transaction = segment.trace.transaction;

  if (scope) transaction.measure(segment.name, scope, duration);

  transaction.measure(segment.name,      null, duration);
  transaction.measure('Memcache/all',    null, duration);
  transaction.measure('Memcache/allWeb', null, duration);
}

/**
 * Thanks to Hernan at ngmoco!
 *
 * instrument the memcached driver to intercept calls and keep stats on them.
 */
module.exports = function initialize(agent, memcached) {
  shimmer.wrapMethod(memcached && memcached.prototype,
                     'memcached.prototype',
                     'command',
                     function (command) {
    return agent.tracer.segmentProxy(function () {
      var state = agent.getState();
      if (!state) return command.apply(this, arguments);

      /* The 'command' function will be called with a single function argument.
       * That function returns a simple object describing the memcached call.
       * Call that function to get that call description.
       */
      var metacall = arguments[0]();

      var current = state.getSegment();

      var name = 'Memcache/' + (metacall.type || 'Unknown');
      var segment = current.add(name, recordMemcacheMetrics);
      state.setSegment(segment);

      /* Memcached's call description includes a callback to apply when the
       * operation is concluded. Wrap that to trace the duration of the
       * operation.
       */
      shimmer.wrapMethod(metacall, 'metacall', 'callback', function (kallback) {
        return agent.tracer.callbackProxy(function wrappedMemcachedCallback() {
          segment.end();
          return kallback.apply(this, arguments);
        });
      });

      // rewrap the metacall for the command object
      var rewrapped = function () { return metacall; };

      // finally, execute the original command
      return command.call(this, rewrapped);
    });
  });
};
