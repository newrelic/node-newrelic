'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

module.exports = function initialize(agent, fs) {
  shimmer.wrapMethod(fs, 'fs', 'readdir', function (original) {
    return agent.tracer.segmentProxy(function (path, callback) {
      var state = agent.getState();
      // this should never happen, but if it does, don't crash
      if (!state) return original(path, callback);

      var name = 'Filesystem/ReadDir/' + path;

      var current = state.getSegment();
      var fsSegment = current.add(name);
      return original(path, agent.tracer.callbackProxy(function () {
        fsSegment.end();
        state.transaction.measure(name, null, current.getDurationInMillis());

        callback.apply(this, arguments);
      }));
    });
  });
};
