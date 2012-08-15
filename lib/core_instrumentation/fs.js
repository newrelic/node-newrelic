'use strict';

var path    = require('path')
  , shimmer =  require(path.join(__dirname, '..', 'shimmer'))
  ;

exports.initialize = function (agent, trace, fs) {
  shimmer.wrapMethod(fs, 'fs', 'readdir', function (original) {
    return function (path, callback) {
      var tx = agent.getTransaction();
      if (!tx) return original(path, callback);

      var tracer = trace.createTracer(agent, 'Filesystem/ReadDir/' + path);
      return original(path, function () {
        tracer.finish();

        callback.apply(this, arguments);
      });
    };
  });
};
