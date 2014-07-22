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
var REQUEST_HEADER = 'x-request-start';
var QUEUE_HEADER = 'x-queue-start';


function wrapListener(agent, listener) {
  if (!listener) throw new Error("No request listener defined, so nothing to do.");

  var tracer = agent.tracer;

  return tracer.transactionProxy(function wrappedHandler(request, response) {
    if (!tracer.getTransaction()) return listener.apply(this, arguments);

    /* Needed for Connect and Express middlewares that monkeypatch request
     * and response via listeners.
     */
    tracer.bindEmitter(request);
    tracer.bindEmitter(response);

    var transaction = tracer.getTransaction()
      , segment     = tracer.addSegment(request.url, recordWeb)
      ;

    // the error tracer needs a URL for tracing, even though naming overwrites
    transaction.url  = request.url;
    transaction.verb = request.method;

    // need to set any config-driven names early for RUM
    transaction.applyUserNamingRules(request.url);

    /**
     * Calculate Queue Time
     *
     * Queue time is provided by certain providers by stamping the request
     * header with the time the request arrived at the router.
     *
     * Units for queue time are
     */
    var start = request.headers[REQUEST_HEADER] || request.headers[QUEUE_HEADER];
    if (start) {

      if (start > 1e18) start = start / 1e6 // nano seconds
      else if (start > 1e15) start = start / 1e3 // micro seconds
      else if (start < 1e12) start = start * 1e3; // seconds

      var qtime = Date.now() - start;
      transaction.queueTime = qtime;
    }

    function instrumentedFinish() {
      /* Express breaks URLs up by application, but the unmodified URL can be
       * recovered from the request via request.originalUrl.
       */
      var url = request.originalUrl || request.url;

      /* Naming must happen before the segment and transaction are ended,
       * because metrics recording depends on naming's side effects.
       */
      transaction.setName(url, response.statusCode);

      // This should be the last thing called before the web segment finishes.
      segment.markAsWeb(url);

      segment.end();
      transaction.end();
    }
    response.once('finish', instrumentedFinish);

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

    if (agent.tracer.getTransaction() && !internalOnly) {
      // hostname & port logic pulled directly from node's 0.10 lib/http.js
      var hostname = options.hostname || options.host || DEFAULT_HOST;
      var port = options.port || options.defaultPort || DEFAULT_PORT;
      instrumentOutbound(agent, requested, hostname, port);
    }

    return requested;
  });
}

function wrapLegacyRequest(agent, request) {
  return agent.tracer.segmentProxy(function wrappedLegacyRequest(method, path, headers) {
    var requested = request.call(this, method, path, headers);

    if (agent.tracer.getTransaction()) {
      instrumentOutbound(agent, requested, this.host, this.port);
    }

    return requested;
  });
}

function wrapLegacyClient(agent, proto) {
  shimmer.wrapMethod(
    proto,
    'http.Client.prototype',
    'request',
    wrapLegacyRequest.bind(null, agent)
  );
}

module.exports = function initialize(agent, http) {
  // FIXME: will this ever not be called?
  shimmer.wrapMethod(http, 'http', 'createServer', function cb_wrapMethod(createServer) {
    return function setDispatcher(requestListener) {
      /*jshint unused:false */
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
                     function cb_wrapMethod(addListener) {
    return function cls_wrapMethod(type, listener) {
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

  // http.Client is deprecated, but still in use
  var DeprecatedClient, deprecatedCreateClient;
  function clearGetters() {
    if (DeprecatedClient) {
      delete http.Client;
      http.Client = DeprecatedClient;
    }
    if (deprecatedCreateClient) {
      delete http.createClient;
      http.createClient = deprecatedCreateClient;
    }
  }

  DeprecatedClient = shimmer.wrapDeprecated(
    http,
    'http',
    'Client',
    {
      get : function get() {
        var example = new DeprecatedClient(80, 'localhost');
        wrapLegacyClient(agent, example.constructor.prototype);
        clearGetters();

        return DeprecatedClient;
      },
      set : function set(NewClient) {
        DeprecatedClient = NewClient;
      }
    }
  );

  deprecatedCreateClient = shimmer.wrapDeprecated(
    http,
    'http',
    'createClient',
    {
      get : function get() {
        var example = deprecatedCreateClient(80, 'localhost');
        wrapLegacyClient(agent, example.constructor.prototype);
        clearGetters();

        return deprecatedCreateClient;
      },
      set : function set(newCreateClient) {
        deprecatedCreateClient = newCreateClient;
      }
    }
  );
};
