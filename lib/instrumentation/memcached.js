'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

function recordMemcacheMetrics(metrics, metricName, duration, scope) {
  metrics.measureDurationUnscoped('Memcache/all', duration);
  metrics.measureDurationUnscoped('Memcache/allWeb', duration);
  metrics.measureDurationUnscoped(metricName, duration);

  if (scope) metrics.measureDurationScoped(metricName, scope, duration);
}

/**
 * Thanks to Hernan at ngmoco!
 *
 * instrument the memcached driver to intercept calls and keep stats on them.
 */
exports.initialize = function (agent, memcached) {
  shimmer.wrapMethod(memcached.prototype, 'memcached.prototype', function (original) {
    return function () {
      var state = agent.getState();
      if (!state) return original.apply(this, arguments);

      /* The 'command' function will be called with a single function argument.
       * That function returns a simple object describing the memcached call.
       * Call that function to get that call description.
       */
      var metacall = arguments[0]();

      var name = 'Memcache/' + (metacall.type || 'Unknown');
      var segment = state.getSegment().add(name, recordMemcacheMetrics);

      /* Memcached's call description includes a callback to apply when the
       * operation is concluded. Wrap that to trace the duration of the
       * operation.
       */
      shimmer.wrapMethod(metacall, 'metacall', 'callback', agent.tracer.callbackProxy(function (original) {
        return function wrappedMemcachedCallback() {
          segment.end();
          original.apply(this, arguments);
        };
      }));

      // rewrap the metacall for the command object
      var rewrapped = function () { return metacall; };

      // finally, call the original function.
      original.apply(this, [rewrapped]);
    };
  });
};
