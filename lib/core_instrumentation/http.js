'use strict';

var path    = require('path')
  , metric  = require(path.join(__dirname, '..', 'metric'))
  ;

exports.initialize = function (agent, trace, http) {
  http._connectionListener = (function (original) {
    return function () {
      agent.environment.setDispatcher('http');
      var transaction = agent.createTransaction();
      var tracer = new trace.Tracer(transaction);
      return original.apply(this, arguments);
    };
  }(http._connectionListener));

  http.createServer = (function (original) {
    return function (cb) {
      agent.environment.setDispatcher('http');

      return original.call(this, function (req, resp) {
        agent.setTransaction(null);
        // FIXME: favicon can toootally cause performance problems, shouldn't special-case it
        if (req.url !== "/favicon.ico") {
          var transaction = agent.createTransaction();
          var tracer = new trace.Tracer(transaction);
          transaction.url = req.url;

          var _end = resp.end;
          resp.end = function () {
            _end.apply(this, arguments);

            transaction.statusCode = resp.statusCode;
            // FIXME get the response status message
            tracer.finish();
            resp.end = _end;
          };
        }
        cb(req, resp);
      });
    };
  }(http.createServer));

  http.Client.prototype.request = (function (original) {
    return function () {
      var req = original.apply(this, arguments);
      var tx = agent.getTransaction();
      if (tx && !this.__NEWRELIC) {
        var tracer = new trace.Tracer(tx, metric.externalMetrics(this.host, 'http'));
        var done = function () {
          tracer.finish();
        };
        // this is the client
        this.on('error', done);
        req.on('response', done);
      }

      return req;
    };
  }(http.Client.prototype.request));
};

