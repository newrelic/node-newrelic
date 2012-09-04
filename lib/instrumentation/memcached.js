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
      var trans = agent.getTransaction();
      if (!trans) return original.apply(this,arguments);

      var args = Array.prototype.slice.call(arguments);

      /* The 'command' function will be called with a single function argument.
       * That function returns a simple object describing the memcached call.
       * Call that function to get that call description.
       */
      var metacall = args[0]();

      var segment = trans.getTrace().add('Memcache/' + (metacall.type || 'Unknown'), recordMemcacheMetrics);

      /* Memcache's call description includes a callback to apply when the
       * operation is concluded. Wrap that to trace the duration of the
       * operation.
       */
      shimmer.wrapMethod(metacall, 'metacall', 'callback', function (original) {
        return function () {
          segment.end();
          original.apply(this, Array.prototype.slice.call(arguments));
          // for memory-safety, unwrap ephemeral callbacks
          shimmer.unwrapMethod(metacall, 'metacall', 'callback');
        };
      });

      // rewrap the metacall for the command object
      var rewrapped = function () { return metacall; };

      // finally, call the original function.
      original.apply(this, [rewrapped]);
    };
  });
};
