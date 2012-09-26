'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

var NR_CONNECTION_PROP = '__NR__connection';

module.exports = function initialize(agent, http) {
  function wrapRequestListener(listener) {
    if (!listener) throw new Error("No request listener defined, so nothing to do.");

    return function wrappedHandler(request, response) {
      /* FIXME: favicon often causes performance problems, should NR
       * special-case it?
       */
      if (request.url !== '/favicon.ico') {
        // Need to punch up through a calling layer to get to this function.
        var transaction = agent.getTransaction();
        var segment     = transaction.getTrace().add(request.url);

        response.once('finish', function instrumentedFinish() {
          segment.end();
          /* Node's http library only offers a status code, not a textual
           * message.
           */
          transaction.measureWeb(request.url,
                                 response.statusCode,
                                 segment.getDurationInMillis());
                                 transaction.end();
        });
      }

      return listener.apply(this, arguments);
    };
  }

  shimmer.wrapMethod(http, 'http', 'createServer', function (original) {
    return function setDispatcher() {
      agent.environment.setDispatcher('http');
      return original.apply(this, arguments);
    };
  });

  /**
   * It's probably not a great idea to monkeypatch EventEmitter methods, and
   * only testing will show if this method works with all supported versions
   * of Node, but this takes care of handlers using the built-in HTTP library,
   * Express, and Restify.
   */
  shimmer.wrapMethod(http.Server.prototype,
                     'http.Server.prototype',
                     ['on', 'addListener'],
                     function (original) {
    return function (type, listener) {
      if (type === 'request') {
        var wrapped = agent.tracer.transactionProxy(wrapRequestListener(listener));
        return original.call(this, type, wrapped);
      }
      else {
        return original.apply(this, arguments);
      }
    };
  });

  /*
   * As of node 0.8, this is the right way to originate outbound requests.
   */
  shimmer.wrapMethod(http, 'http', 'request', function (original) {
    return agent.tracer.segmentProxy(function wrappedRequest(options, callback) {
      var internalOnly = options && options[NR_CONNECTION_PROP];

      // don't pollute what the original method sees
      if (internalOnly) delete options[NR_CONNECTION_PROP];

      var request = original.apply(this, [options, agent.tracer.callbackProxy(callback)]);

      if (!internalOnly) {
        var transaction = agent.getTransaction();
        if (transaction) {
          var segment = transaction.getTrace().add(request.path,
                                                   transaction.metrics.externalMetrics(options.host, 'http'));

          /*
           * Current semantics are that the request has finished when the
           * first byte hits the stream.
           *
           * FIXME: this does not strike me as a sound assumption.
           */
          if (this.on) this.on('error', segment.end.bind(segment));
          if (request.on) request.on('response', segment.end.bind(segment));
        }
      }

      return request;
    });
  });

  /*
   * http.createClient is deprecated.
   */
  shimmer.wrapMethod(http, 'http', 'createClient', function (original) {
    return agent.tracer.segmentProxy(function wrappedDeprecatedRequest(port, host) {
      var request = original.apply(this, arguments);

      var transaction = agent.getTransaction();
      if (transaction) {
        var segment = transaction.getTrace().add(request.path,
                                                 agent.metrics.externalMetrics(host, 'http'));

        /*
         * Current semantics are that the request has finished when the
         * first byte hits the stream.
         *
         * FIXME: this does not strike me as a sound assumption.
         */
        if (this.on) this.on('error', segment.end.bind(segment));
        if (request.on) request.on('response', segment.end.bind(segment));
      }

      return request;
    });
  });
};
