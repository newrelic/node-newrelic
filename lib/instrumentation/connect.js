'use strict';

var path    = require('path')
  , http    = require('http')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

// the connect module is used by Express
exports.initialize = function (agent, trace, connect) {
  shimmer.wrapMethod(connect.HTTPServer.prototype, 'connect.HTTPServer.prototype',
                     'handle', function (original) {
    return function (req, res, out) {
      var transaction = agent.createTransaction();
      transaction.url = req.url;

      var tracer = new trace.createTracer(agent);
      tracer.appendToStack(new Error());

      try {
        original.apply(this, arguments);
      }
      finally {
        transaction.statusCode = res.statusCode;
        // FIXME get the response status message
        tracer.finish();
      }
    };
  });
};
