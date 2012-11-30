'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

var NR_CONNECTION_PROP = '__NR__connection';

module.exports = function initialize(agent, http) {
  function wrapRequestListener(listener) {
    if (!listener) throw new Error("No request listener defined, so nothing to do.");

    return function wrappedHandler(request, response) {
      var state = agent.getState();

      /* FIXME: favicon often causes performance problems, should NR
       * special-case it?
       */
      if (state && request.url !== '/favicon.ico') {
        var transaction = state.getTransaction();
        var segment     = state.getSegment().addWeb(request.url);

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

      var request;
      if (callback) {
        request = original.call(this, options, agent.tracer.callbackProxy(callback));
      }
      else {
        request = original.apply(this, arguments);
      }

      if (!internalOnly) {
        var state = agent.getState();
        if (state) {
          var name        = 'External/' + options.host + request.path
            , transaction = state.getTransaction()
            , gatherer    = transaction.metrics.externalMetrics(options.host, 'http')
            , segment     = state.getSegment().add(name, gatherer)
            ;
          state.setSegment(segment);

          /*
           * Current semantics are that the request has finished when the
           * first byte hits the stream.
           *
           * FIXME: this does not strike me as a sound assumption.
           */
          if (this.on) this.on('error', segment.end.bind(segment));
          if (request.on) request.on('finish', segment.end.bind(segment));
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

      var state = agent.getState();
      if (state) {
        var name        = 'External/' + host + request.path
          , transaction = state.getTransaction()
          , gatherer    = agent.metrics.externalMetrics(host, 'http')
          , segment     = transaction.getTrace().add(name, gatherer)
          ;
        state.setSegment(segment);

        /*
         * Current semantics are that the request has finished when the
         * first byte hits the stream.
         *
         * FIXME: this does not strike me as a sound assumption.
         */
        if (this.on) this.on('error', segment.end.bind(segment));
        if (request.on) request.on('finish', segment.end.bind(segment));
      }

      return request;
    });
  });
};
