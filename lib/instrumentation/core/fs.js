'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

module.exports = function initialize(agent, fs) {
  shimmer.wrapMethod(fs, 'fs', 'readdir', function (readdir) {
    return agent.tracer.segmentProxy(function (path, unwrapped) {
      var monitor     = agent.errors.monitor.bind(agent.errors)
        , transaction = agent.getTransaction()
        ;

      var callback;
      if (!transaction) {
        callback = unwrapped;
      }
      else {
        var name    = 'Filesystem/ReadDir/' + path
          , current = agent.getState().getSegment()
          , segment = current.add(name)
          ;

        callback = agent.tracer.callbackProxy(function () {
          segment.end();
          transaction.measure(name, null, segment.getDurationInMillis());

          unwrapped.apply(this, arguments);
        });
      }

      return monitor(readdir.bind(this, path, callback), transaction);
    });
  });
};
