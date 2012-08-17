'use strict';

var http    = require('http')
  , path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , logger  = require(path.join(__dirname, '..', 'logger'))
  ;

// instrument express views
function instrumentViews(agent, trace) {
  logger.debug('Instrumenting Express views');
  shimmer.wrapMethod(
    http.ServerResponse.prototype,
    'http.ServerResponse.prototype',
    'render',
    function (original) {
      return function (view) {
        var tracer = trace.createTracer(agent, 'View/' + view + '/Rendering');
        tracer.appendToStack(new Error());
        try {
          original.apply(this, arguments);
        }
        finally {
          tracer.finish();
        }
      };
    }
  );
}

module.exports = function initialize(agent, trace, express) {
  // hook the createServer method to record the framework
  shimmer.wrapMethod(express, 'express', 'createServer', function (original) {
    return function (options) {
      instrumentViews(agent, trace);
      agent.environment.setDispatcher('express');
      agent.environment.setFramework('express');
      logger.debug('New Relic has instrumented this Express endpoint');

      return original.apply(this, arguments);
    };
  });
};
