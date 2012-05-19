var path    = require('path')
  , http    = require('http')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

// the connect module is used by Express
exports.initialize = function (agent, trace, connect) {
  var handle = shimmer.preserveMethod(connect.HTTPServer.prototype, 'handle');
  connect.HTTPServer.prototype.handle = function (req, res, out) {
    var transaction = agent.createTransaction();
    transaction.url = req.url;

    var tracer = new trace.Tracer(transaction);
    tracer.appendToStack(new Error());

    try {
      handle.apply(this, arguments);
    }
    finally {
      transaction.statusCode = res.statusCode;
      // FIXME get the response status message
      tracer.finish();
    }
  };
};
