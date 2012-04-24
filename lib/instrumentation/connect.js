var http = require('http');

// the connect module is used by Express
exports.initialize = function (agent, trace, connect) {
  var _handle = connect.HTTPServer.prototype.handle;
  connect.HTTPServer.prototype.handle = function (req, res, out) {
    var transaction = agent.createTransaction();
    var tracer = new trace.Tracer(transaction);
    transaction.url = req.url;
    tracer.appendToStack(new Error());
    try {
      _handle.apply(this, arguments);
    }
    finally {
      transaction.statusCode = res.statusCode;
      // FIXME get the response status message
      tracer.finish();
    }
  };
};
