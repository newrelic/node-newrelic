'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  , Tracer  = require(path.join(__dirname, '..', '..', 'trace-legacy', 'tracer'))
  ;

module.exports = function initialize(agent, trace, http) {
  shimmer.wrapMethod(http, 'http', '_connection_listener', function (original) {
    return function () {
      agent.environment.setDispatcher('http');
      var transaction = agent.createTransaction();
      var tracer = new Tracer(transaction);
      return original.apply(this, arguments);
    };
  });

  shimmer.wrapMethod(http, 'http', 'createServer', function (original) {
    return function (cb) {
      agent.environment.setDispatcher('http');

      return original.call(this, function (req, resp) {
        agent.setTransaction(null);
        /* FIXME: favicon can toootally cause performance problems,
         * shouldn't special-case it
         */
        if (req.url !== '/favicon.ico') {
          var transaction = agent.createTransaction();
          var tracer = new Tracer(transaction);
          transaction.url = req.url;

          shimmer.wrapMethod(resp, 'resp', 'end', function (original) {
            return function () {
              original.apply(this, arguments);
              transaction.statusCode = resp.statusCode;
              // FIXME get the response status message
              tracer.finish();
              shimmer.unwrapMethod(resp, 'resp', 'end');
            };
          });
        }
        cb(req, resp);
      });
    };
  });

  shimmer.wrapMethod(http.Client.prototype, 'http.Client.prototype', 'request', function (original) {
    return function () {
      var req = original.apply(this, arguments);
      var tx = agent.getTransaction();
      if (tx && !this.__NEWRELIC) {
        var tracer = new Tracer(tx, agent.metrics.externalMetrics(this.host, 'http'));
        var done = function () {
          tracer.finish();
        };
        // this is the client
        this.on('error', done);
        req.on('response', done);
      }

      return req;
    };
  });
};

