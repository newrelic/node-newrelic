'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

function recordMemcacheMetrics(tracer, unscopedStats, scopedStats) {
  [unscopedStats.byName("Memcache/all"),
   unscopedStats.byName("Memcache/allWeb"),
   unscopedStats.byName(tracer.metricName),
   scopedStats.byName(tracer.metricName)].forEach(function (stat) {
     stat.recordValueInMillis(tracer.getDurationInMillis());
   });
}

/**
 * Thanks to Hernan at ngmoco!
 *
 * instrument the memcached driver to intercept calls and keep stats on them.
 */
exports.initialize = function (agent, trace, memcached) {
  shimmer.wrapMethod(memcached.prototype, 'memcached.prototype', function (original) {
    return function () {
      var tx = agent.getTransaction();

      if (!tx) return original.apply(this,arguments);

      var args = Array.prototype.slice.call(arguments);

      /* The 'command' function will be called with a single function argument.
       * That function returns a simple object describing the memcached call.
       * Call that function to get that call description.
       */
      var metacall = args[0]();

      var tracer = new trace.Tracer(tx, recordMemcacheMetrics);
      tracer.metricName = 'Memcache/' + (metacall.type || 'Unknown');

      /* Memcache's call description includes a callback to apply when the
       * operation is concluded. Wrap that to trace the duration of the
       * operation.
       */
      shimmer.wrapMethod(metacall, 'metacall', 'callback', function (original) {
        return function () {
          tracer.finish();
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
