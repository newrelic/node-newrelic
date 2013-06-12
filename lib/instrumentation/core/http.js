'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

var NR_CONNECTION_PROP = '__NR__connection';

module.exports = function initialize(agent, http) {
  function wrapRequestListener(listener) {
    if (!listener) throw new Error("No request listener defined, so nothing to do.");

    return function wrappedHandler(request, response) {
      var state       = agent.getState()
        , transaction = state.getTransaction()
        ;

      /* FIXME: favicon often causes performance problems, should NR
       * special-case it?
       */
      if (state && request.url !== '/favicon.ico') {
        var url     = request.url
          , segment = state.getSegment().addWeb(url)
          ;

        response.once('finish', function instrumentedFinish() {
          segment.end();
          /* Node's http library only offers a status code, not a textual
           * message.
           */
          transaction.measureWeb(url,
                                 response.statusCode,
                                 segment.getDurationInMillis());
          transaction.end();
        });
      }

      return agent.errors.monitor(function (args) {
        return listener.apply(this, args);
      }.bind(this, arguments), transaction);
    };
  }

  shimmer.wrapMethod(http, 'http', 'createServer', function (createServer) {
    return function setDispatcher() {
      agent.environment.setDispatcher('http');
      return createServer.apply(this, arguments);
    };
  });

  /**
   * It's probably not a great idea to monkeypatch EventEmitter methods, and
   * only testing will show if this method works with all supported versions
   * of Node, but this takes care of handlers using the built-in HTTP library,
   * Express, and Restify.
   */
  shimmer.wrapMethod(http && http.Server && http.Server.prototype,
                     'http.Server.prototype',
                     ['on', 'addListener'],
                     function (addListener) {
    return function (type, listener) {
      if (type === 'request' && typeof listener === 'function') {
        var wrapped = agent.tracer.transactionProxy(wrapRequestListener(listener));
        return addListener.call(this, type, wrapped);
      }
      else {
        return addListener.apply(this, arguments);
      }
    };
  });

  /*
   * As of node 0.8, this is the right way to originate outbound requests.
   */
  shimmer.wrapMethod(http, 'http', 'request', function (request) {
    return agent.tracer.segmentProxy(function wrappedRequest(options, callback) {
      var internalOnly = options && options[NR_CONNECTION_PROP];
      // don't pollute what the wrapped request sees
      if (internalOnly) delete options[NR_CONNECTION_PROP];

      var requested
        , state = agent.getState()
        ;

      if (state) {
        var transaction = state.getTransaction();

        if (callback) {
          requested = request.call(this, options, agent.tracer.callbackProxy(callback));
        }
        else {
          requested = agent.errors.monitor(function (args) {
            return request.apply(this, args);
          }.bind(this, arguments), transaction);
        }

        if (!internalOnly) {
          var name        = 'External/' + options.host + requested.path
            , gatherer    = transaction.metrics.externalMetrics(options.host, 'http')
            , segment     = state.getSegment().add(name, gatherer)
            ;

          state.setSegment(segment);

          if (this.once) {
            this.once('error', function (err) {
              agent.errors.add(err);
              segment.end();
            });
          }

          if (requested.on) {
            requested.on('response', function (res) {
              res.once('end', segment.end.bind(segment));
            });
          }
        }
      }
      else {
        if (callback) {
          /* Even if requested isn't in a transaction on start, ensure it will
           * propagate context.
           */
          requested = request.call(this, options, agent.tracer.callbackProxy(callback));
        }
        else {
          requested = request.apply(this, arguments);
        }
      }

      return requested;
    });
  });

  /*
   * http.createClient is deprecated.
   */
  shimmer.wrapMethod(http, 'http', 'createClient', function (createClient) {
    return agent.tracer.segmentProxy(function wrappedDeprecatedRequest(port, host) {
      var request = createClient.apply(this, arguments);

      var state = agent.getState();
      if (state) {
        var name        = 'External/' + host + request.path
          , transaction = state.getTransaction()
          , gatherer    = agent.metrics.externalMetrics(host, 'http')
          , segment     = transaction.getTrace().add(name, gatherer)
          ;
        state.setSegment(segment);

        if (this.once) this.once('error', function (err) {
          agent.errors.add(err);
          segment.end();
        });
        if (request.on) request.on('response', function (res) {
          res.once('end', segment.end.bind(segment));
        });
      }

      return request;
    });
  });
};
