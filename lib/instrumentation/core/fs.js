'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

module.exports = function initialize(agent, fs) {
  shimmer.wrapMethod(fs, 'fs', 'readdir', function (readdir) {
    return agent.tracer.segmentProxy(function (path, callback) {
      var state = agent.getState();
      if (!state) return agent.errors.monitor(null, function () {
        return readdir(path, callback); // not part of a transaction
      }, this, arguments);

      var name        = 'Filesystem/ReadDir/' + path
        , current     = state.getSegment()
        , fsSegment   = current.add(name)
        , transaction = state.getTransaction()
        ;

      return agent.errors.monitor(transaction, function () {
        return readdir(path, agent.tracer.callbackProxy(function () {
          fsSegment.end();
          state.transaction.measure(name, null, fsSegment.getDurationInMillis());

          return agent.errors.monitor(transaction, callback, this, arguments);
        }));
      });
    });
  });
};
