'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

var NR_CONNECTION_PROP = '__NR__connection';

module.exports = function initialize(agent, http) {
  shimmer.wrapMethod(http, 'http', '_connectionListener', function (original) {
    return function wrappedConnectionListener() {
      agent.environment.setDispatcher('http');

      var transaction = agent.createTransaction();
      transaction.add('_connectionListener');

      return original.apply(this, arguments);
    };
  });

  shimmer.wrapMethod(http, 'http', 'createServer', function (original) {
    return function wrappedCreateServer(actualHandler) {
      agent.environment.setDispatcher('http');

      return original.call(this, function instrumentedServerHandler(request, response) {
        /* FIXME: favicon often causes performance problems, should NR
         * special-case it?
         */
        if (request.url !== '/favicon.ico') {
          // Need to punch up through a calling layer to get to this function.
          var transaction = agent.createTransaction();
          var probe = transaction.getTrace().add(request.url);

          response.once('finish', function instrumentedHttpOnFinish() {
            probe.end();
            /* Node's http library only offers a status code, not a textual
             * message.
             */
            transaction.measureWeb(request.url,
                                   response.statusCode,
                                   probe.getDurationInMillis());
            transaction.end();
          });
        }
        actualHandler(request, response);
      });
    };
  });

  /*
   * As of node 0.8, this is the right way to originate outbound requests.
   */
  shimmer.wrapMethod(http, 'http',
                     'request', function (original) {
    return function wrappedRequest() {
      var options = arguments[0];
      var internalOnly = options && options[NR_CONNECTION_PROP];

      // don't pollute what the original method sees
      if (internalOnly) delete options[NR_CONNECTION_PROP];

      var request = original.apply(this, arguments);

      if (!internalOnly) {
        var transaction = agent.getTransaction();
        if (transaction) {
          var probe = transaction.getTrace().add(request.path,
                                                 transaction.metrics.externalMetrics(options.host, 'http'));

          /*
           * Current semantics are that the request has finished when the
           * first byte hits the stream.
           *
           * FIXME: this does not strike me as a sound assumption.
           */
          if (this.on) this.on('error', probe.end.bind(probe));
          if (request.on) request.on('response', probe.end.bind(probe));
        }
      }

      return request;
    };
  });

  /*
   * http.createClient is deprecated.
   */
  shimmer.wrapMethod(http, 'http', 'createClient', function (original) {
    return function wrappedDeprecatedRequest(port, host) {
      var request = original.apply(this, arguments);

      var transaction = agent.getTransaction();
      if (transaction) {
        var probe = transaction.getTrace().add(request.path,
                                               agent.metrics.externalMetrics(host, 'http'));

        /*
         * Current semantics are that the request has finished when the
         * first byte hits the stream.
         *
         * FIXME: this does not strike me as a sound assumption.
         */
        if (this.on) this.on('error', probe.end.bind(probe));
        if (request.on) request.on('response', probe.end.bind(probe));
      }

      return request;
    };
  });
};
