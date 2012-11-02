'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

module.exports = function initialize(agent, generic) {
  shimmer.wrapMethod(generic, 'generic-pool', 'Pool', function (original) {
    return function () {
      var pooler = original.apply(this, arguments) ;

      shimmer.wrapMethod(pooler, 'Pool', 'acquire', function (acquire) {
        return function propagateTransactionThroughPool() {
          var args = Array.prototype.slice.call(arguments);
          var callback = args[0]; // yes, really
          if (typeof callback === 'function') { // gotta make sure
            args[0] = agent.tracer.callbackProxy(callback);
          }

          return acquire.apply(this, args);
        };
      });

      return pooler;
    };
  });
};
