'use strict';

var path    = require('path')
  , shimmer =  require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

module.exports = function initialize(agent, fs) {
  shimmer.wrapMethod(fs, 'fs', 'readdir', function (original) {
    return function (path, callback) {
      var trans = agent.getTransaction();
      if (!trans) return original(path, callback);

      var segment = trans.getTrace().add('Filesystem/ReadDir/' + path);
      return original(path, function () {
        segment.end();
        // FIXME: hax to get the cut over from legacy tracing working, not the final solution
        trans.measure('Filesystem/ReadDir/' + path, 'FIXME', segment.getDurationInMillis());

        callback.apply(this, arguments);
      });
    };
  });
};
