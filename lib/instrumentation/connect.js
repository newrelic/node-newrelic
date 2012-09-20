'use strict';

var path    = require('path')
  , http    = require('http')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

// the connect module is used by Express
module.exports = function initialize(agent, connect) {
  shimmer.wrapMethod(connect.HTTPServer.prototype, 'connect.HTTPServer.prototype',
                     'handle', function wrappedHandle(original) {
    return function (request, response, out) {
      var transaction = agent.createTransaction();
      var segment = transaction.getTrace().add(request.url);

      response.once('finish', function instrumentedConnectHandleOnFinish() {
        segment.end();
        transaction.measureWeb(request.url,
                               response.statusCode,
                               segment.getDurationInMillis());
        transaction.end();
      });

      original.apply(this, arguments);
    };
  });
};
