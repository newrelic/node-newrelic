'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

module.exports = function initialize(agent, fs) {
  shimmer.wrapMethod(fs, 'fs', 'readdir', function (original) {
    return agent.tracer.segmentProxy(function (path, callback) {
      var state = agent.getState();
      if (!state) return agent.errors.monitor(function () {
        return original(path, callback); // not part of a transaction
      });

      var name        = 'Filesystem/ReadDir/' + path
        , current     = state.getSegment()
        , fsSegment   = current.add(name)
        , transaction = state.getTransaction()
        ;

      return agent.errors.monitor(transaction, function () {
        return original(path, agent.tracer.callbackProxy(function () {
          fsSegment.end();
          state.transaction.measure(name, null, fsSegment.getDurationInMillis());

          var args = Array.prototype.slice.call(arguments);
          return agent.errors.monitor(transaction, function () {
            return callback.apply(this, args);
          });
        }));
      });
    });
  });
};
