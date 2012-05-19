var http    = require('http')
  , path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , logger  = require(path.join(__dirname, '..', 'logger'))
  ;

// instrument express views
function instrumentViews(agent, trace) {
  logger.debug('instrumenting Express views');
  var render = shimmer.preserveMethod(http.ServerResponse.prototype, 'render');
  http.ServerResponse.prototype.render = function (view) {

    var tracer = trace.createTracer(agent, 'View/' + view + '/Rendering');
    tracer.appendToStack(new Error());
    try {
      render.apply(this, arguments);
    }
    finally {
      tracer.finish();
    }
  };
}

exports.initialize = function (agent, trace, express) {
  logger.debug('instrumenting Express');
  // hook the createServer method to record the framework
  var createServer = shimmer.preserveMethod(express, 'createServer');
  express.createServer = function (options) {
    instrumentViews(agent, trace);
    agent.environment.setDispatcher('express');
    agent.environment.setFramework('express');
    logger.debug('running instrumented Express endpoint');

    return createServer.apply(this, arguments);
  };
};
