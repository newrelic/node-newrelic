'use strict';

var path               = require('path')
  , shimmer            = require(path.join(__dirname, '..', '..', 'shimmer.js'))
  , recordWeb          = require(path.join(__dirname, '..', '..', 'metrics',
                                           'recorders', 'http.js'))
  , instrumentOutbound = require(path.join(__dirname, '..', '..', 'transaction',
                                           'tracer', 'instrumentation', 'outbound.js'))
  ;

/*
 *
 * CONSTANTS
 *
 */
var NR_CONNECTION_PROP = '__NR__connection';
var DEFAULT_HOST = 'localhost';
var DEFAULT_PORT = 80;

function wrapListener(agent, listener) {
  if (!listener) throw new Error("No request listener defined, so nothing to do.");

  return agent.tracer.transactionProxy(function wrappedHandler(request, response) {
    if (!agent.tracer.getState()) return listener.apply(this, arguments);

    /* Needed for Connect and Express middlewares that monkeypatch request
     * and response via listeners.
     */
    agent.tracer.bindEmitter(request);
    agent.tracer.bindEmitter(response);

    var state       = agent.tracer.getState()
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
  });
}

function wrapRequest(agent, request) {
  return agent.tracer.segmentProxy(function wrappedRequest(options, callback) {
    if (callback && typeof callback === 'function') {
      // want to bind callack into request regardless of current state
      callback = agent.tracer.callbackProxy(callback);
    }

    // don't pollute metrics and calls with NR connections
    var internalOnly = options && options[NR_CONNECTION_PROP];
    if (internalOnly) options[NR_CONNECTION_PROP] = undefined;

    var requested = request.call(this, options, callback);

    if (agent.tracer.getState() && !internalOnly) {
      // hostname & port logic pulled directly from node's 0.10 lib/http.js
      var hostname = options.hostname || options.host || DEFAULT_HOST;
      var port = options.port || options.defaultPort || DEFAULT_PORT;
      instrumentOutbound(agent, requested, hostname, port);
    }

    return requested;
  });
}

function wrapCreateClient(agent, createClient) {
  return agent.tracer.segmentProxy(function wrappedCreateClient(port, host) {
    var requested = createClient.call(this, port, host);

    if (agent.tracer.getState()) {
      instrumentOutbound(agent, requested, requested.host, requested.port);
    }

    return requested;
  });
}

module.exports = function initialize(agent, http) {
  // FIXME: will this ever not be called?
  shimmer.wrapMethod(http, 'http', 'createServer', function (createServer) {
    return function setDispatcher() {
      agent.environment.setDispatcher('http');
      return createServer.apply(this, arguments);
    };
  });

  /**
   * It's not a great idea to monkeypatch EventEmitter methods given how hot
   * they are, but this method is simple and works with all versions of
   * node supported by the module.
   */
  shimmer.wrapMethod(http && http.Server && http.Server.prototype,
                     'http.Server.prototype',
                     ['on', 'addListener'],
                     function (addListener) {
    return function (type, listener) {
      if (type === 'request' && typeof listener === 'function') {
        return addListener.call(this, type, wrapListener(agent, listener));
      }
      else {
        return addListener.apply(this, arguments);
      }
    };
  });

  /**
   * As of node 0.8, http.request() is the right way to originate outbound
   * requests.
   */
  if (http && http.Agent && http.Agent.prototype && http.Agent.prototype.request) {
    // Node 0.11+ always uses an Agent.
    shimmer.wrapMethod(
      http.Agent.prototype,
      'http.Agent.prototype',
      'request',
      wrapRequest.bind(null, agent)
    );
  }
  else {
    shimmer.wrapMethod(
      http,
      'http',
      'request',
      wrapRequest.bind(null, agent)
    );
  }

  // http.createClient is deprecated, but still in use
  shimmer.wrapMethod(http, 'http', 'createClient', wrapCreateClient.bind(null, agent));
};
