'use strict';

var path    = require('path')
  , http    = require('http')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

// the connect module is used by Express
module.exports = function initialize(agent, connect) {
  shimmer.wrapMethod(connect.HTTPServer.prototype, 'connect.HTTPServer.prototype',
                     'handle', function (original) {
    return function (request, response, out) {
      var transaction = agent.createTransaction();
      var probe = transaction.getTrace().add(request.url);

      try {
        original.apply(this, arguments);
      }
      finally {
        probe.end();
        transaction.measureWeb(request.url,
                               response.statusCode,
                               probe.getDurationInMillis());
        transaction.end();
      }
    };
  });
};
