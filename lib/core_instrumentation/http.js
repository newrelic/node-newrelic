'use strict';

var path    = require('path')
  , metric  = require(path.join(__dirname, '..', 'metric'))
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

exports.initialize = function (agent, trace, http) {
  var createServer = shimmer.preserveMethod(http, 'createServer');
  http.createServer = function (cb) {
    agent.environment.setDispatcher('http');

    return createServer(function (req, resp) {
      agent.setTransaction(null);
      // FIXME: favicon can toootally cause performance problems, shouldn't special-case it
      if (req.url !== "/favicon.ico") {
        var transaction = agent.createTransaction();
        transaction.url = req.url;
        var tracer = new trace.createTracer(agent);

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

  var request = shimmer.preserveMethod(http.Client.prototype, 'request');
  http.Client.prototype.request = function () {
    var req = request.apply(this, arguments);
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
};

