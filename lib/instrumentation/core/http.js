'use strict';

var path           = require('path')
  , shimmer        = require(path.join(__dirname, '..', '..', 'shimmer.js'))
  , recordExternal = require(path.join(__dirname, '..', '..', 'metrics',
                                       'recorders', 'http_external.js'))
  , recordWeb      = require(path.join(__dirname, '..', '..', 'metrics',
                                       'recorders', 'http.js'))
  , NAMES          = require(path.join(__dirname, '..', '..', 'metrics', 'names.js'))
  ;

/*
 * CONSTANTS
 */
var NR_CONNECTION_PROP = '__NR__connection';

module.exports = function initialize(agent, http) {
  var tracer = agent.tracer;

  function wrapRequestListener(listener) {
    if (!listener) throw new Error("No request listener defined, so nothing to do.");

    return function wrappedHandler(request, response) {
      if (!tracer.getState()) return listener.apply(this, arguments);

      var state       = tracer.getState()
        , transaction = state.getTransaction()
        , segment     = state.getSegment().add(request.url, recordWeb)
        ;

      // the error tracer needs a URL for tracing, even though naming overwrites
      transaction.url  = request.url;
      transaction.verb = request.method;

      function instrumentedFinish() {
        /* Express breaks URLs up by application, but the unmodified URL can be
         * recovered from the request via request.originalUrl.
         */
        var url = request.originalUrl || request.url;

        /* Naming must happen before the segment and transaction are ended,
         * because metrics recording depends on naming's side effects.
         */
        transaction.setName(url, response.statusCode);
        // request.params will only be set by Connect and Restify
        if (!transaction.ignore) segment.markAsWeb(url, request.params);

        segment.end();
        transaction.end();
      }
      response.once('finish', instrumentedFinish);

      state.setSegment(segment);

      return listener.apply(this, arguments);
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
        var wrapped = tracer.transactionProxy(wrapRequestListener(listener));
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
    return tracer.segmentProxy(function wrappedRequest(options, callback) {
      var internalOnly = options && options[NR_CONNECTION_PROP];
      // don't pollute what the wrapped request sees
      if (internalOnly) delete options[NR_CONNECTION_PROP];

      var requested
        , state = tracer.getState()
        ;

      if (state) {
        var transaction = state.getTransaction();

        if (callback) {
          requested = request.call(this, options, tracer.callbackProxy(callback));
        }
        else {
          requested = agent.errors.monitor(function (args) {
            return request.apply(this, args);
          }.bind(this, arguments), transaction);
        }

        if (!internalOnly) {
          // hostname logic pulled directly from node's 0.10 lib/http.js
          var hostname = options.hostname || options.host || 'localhost'
            , name     = NAMES.EXTERNAL.PREFIX + hostname + requested.path
            , gatherer = recordExternal(hostname, 'http')
            , segment  = state.getSegment().add(name, gatherer)
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
          requested = request.call(this, options, tracer.callbackProxy(callback));
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
    return tracer.segmentProxy(function wrappedDeprecatedRequest(port, host) {
      var request = createClient.apply(this, arguments);

      var state = tracer.getState();
      if (state) {
        var name        = NAMES.EXTERNAL.PREFIX + host + request.path
          , transaction = state.getTransaction()
          , gatherer    = recordExternal(host, 'http')
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
