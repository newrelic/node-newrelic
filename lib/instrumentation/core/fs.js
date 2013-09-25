'use strict';

var path       = require('path')
  , shimmer    = require(path.join(__dirname, '..', '..', 'shimmer'))
  , record     = require(path.join(__dirname, '..', '..', 'metrics',
                                   'recorders', 'generic.js'))
  , FILESYSTEM = require(path.join(__dirname, '..', '..', 'metrics', 'names')).FILESYSTEM
  ;

module.exports = function initialize(agent, fs) {
  var tracer = agent.tracer;

  shimmer.wrapMethod(fs, 'fs', 'readdir', function (readdir) {
    return tracer.segmentProxy(function (path, unwrapped) {
      var state = tracer.getState();
      if (!state || arguments.length < 1) return readdir.apply(this, arguments);

      var name    = FILESYSTEM.READDIR + '/' + path
        , segment = state.getSegment().add(name, record)
        ;

      var callback = tracer.callbackProxy(function () {
        var returned = unwrapped.apply(this, arguments);
        segment.end();

        return returned;
      });

      return readdir.call(this, path, callback);
    });
  });
};
