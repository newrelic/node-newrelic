'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  , Tracer  = require(path.join(__dirname, '..', '..', 'legacy', 'tracer'))
  ;

var NR_CONNECTION_PROP = '__NR__connection';

module.exports = function initialize(agent, trace, http) {
  shimmer.wrapMethod(http, 'http', '_connectionListener', function (original) {
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
        /* FIXME: favicon often causes performance problems, should NR
         * special-case it?
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
            };
          });
        }
        cb(req, resp);
      });
    };
  });

  /**
   * Take in a constructor and call it, setting up a transaction trace wrapper
   * around it. Only pay attention to requests that are not part of the agent's
   * own framework.
   *
   * @param {Request} original The unpatched HTTP client constructor.
   */
  var createRequestWrapper = function (original, internalOnly) {
    return function () {
      var request = original.apply(this, arguments);

      if (!internalOnly) {
        var transaction = agent.getTransaction();
        if (transaction) {
          var tracer = new Tracer(transaction,
                                  agent.metrics.externalMetrics(this.host, 'http'));

          /*
           * Current semantics are that the request has finished when the
           * first byte hits the stream.
           *
           * FIXME: this does not strike me as a sound assumption.
           */
          if (this.on) this.on('error', tracer.finish);
          if (request.on) request.on('response', tracer.finish);
        }
      }

      return request;
    };
  };

  /*
   * As of node 0.8, this is the right way to originate outbound requests.
   */
  shimmer.wrapMethod(http, 'http',
                     'request', function (original) {
    var options = arguments[0];
    var internalOnly = options && options[NR_CONNECTION_PROP];

    // don't pollute what the original method sees
    if (internalOnly) delete options[NR_CONNECTION_PROP];

    return createRequestWrapper(original, internalOnly);
  });

  /**
   * The framework only uses the latest method for calling out.
   */
  var createLegacyRequestWrapper = function (original) {
    return createRequestWrapper(original, false);
  };

  /*
   * http.Client.request and http.createClient are deprecated.
   */
  shimmer.wrapMethod(http.Client.prototype, 'http.Client.prototype',
                     'request', createLegacyRequestWrapper);
  shimmer.wrapMethod(http, 'http',
                     'createClient', createLegacyRequestWrapper);
};

