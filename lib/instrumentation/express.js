var http = require('http');

// instrument express views
function instrumentViews(agent, trace) {
  var _render = http.ServerResponse.prototype.render;
  http.ServerResponse.prototype.render = function (view) {

    var tracer = trace.createTracer(agent, 'View/' + view + '/Rendering');
    tracer.appendToStack(new Error());
    try {
      _render.apply(this, arguments);
    }
    finally {
      tracer.finish();
    }
  };
}

exports.initialize = function (agent, trace, express) {
  // hook the createServer method to record the framework
  var _createServer = express.createServer;
  express.createServer = function (options) {
    instrumentViews(agent, trace);
    agent.environment.setDispatcher('express');
    agent.environment.setFramework('express');

    return _createServer.apply(this, arguments);
  };
};
