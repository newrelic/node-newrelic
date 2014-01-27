'use strict';

var path = require('path')
  , logger       = require(path.join(__dirname, '..', 'logger'))
      .child({component : 'collector_api'})
  , facts        = require(path.join(__dirname, 'facts.js'))
  , RemoteMethod = require(path.join(__dirname, 'remote-method.js'))
  ;

/*
 *
 * CONSTANTS
 *
 */

// just to make clear what's going on
var TO_MILLIS = 1000;

// taken directly from Python agent's newrelic.core.application
var BACKOFFS = [
  {interval :  15, warn : false},
  {interval :  15, warn : false},
  {interval :  30, warn : false},
  {interval :  60, warn :  true},
  {interval : 120, warn : false},
  {interval : 300, warn : false}
];

var ERRORS = {
  INVALID_LICENSE : 'NewRelic::Agent::LicenseException',
  RESTART         : 'NewRelic::Agent::ForceRestartException',
  DISCONNECT      : 'NewRelic::Agent::ForceDisconnectException',
  MAINTENANCE     : 'NewRelic::Agent::MaintenanceError',
  RUNTIME         : 'RuntimeError'
};

var HTTP_REQUEST_TOO_LARGE      = 413
  , HTTP_UNSUPPORTED_MEDIA_TYPE = 415
  , HTTP_LOL_COLLECTOR          = 503
  ;

function dumpErrors(errors, name) {
  var index = 1;

  errors.forEach(function (error) {
    logger.trace(error, "Error %s during %s:", index++, name);

    if (error.laterErrors) error.laterErrors.forEach(function (error) {
      logger.trace(error, "Error %s during %s:", index++, name);
    });
  });
}

function CollectorAPI(agent) {
  this._agent = agent;

  /* RemoteMethods can be reused and have little per-object state, so why not
   * save some GC time?
   */
  this._methods = {
    redirect  : new RemoteMethod('get_redirect_host',       agent.config),
    handshake : new RemoteMethod('connect',                 agent.config),
    errors    : new RemoteMethod('error_data',              agent.config),
    metrics   : new RemoteMethod('metric_data',             agent.config),
    traces    : new RemoteMethod('transaction_sample_data', agent.config),
    sqls      : new RemoteMethod('sql_trace_data',          agent.config),
    shutdown  : new RemoteMethod('shutdown',                agent.config)
  };
}

CollectorAPI.prototype.connect = function connect(callback) {
  if (!callback) throw new TypeError("callback is required");

  var api      = this
    , attempts = 1
    , max      = BACKOFFS.length
    , errors   = []
    ;

  function retry(error, response, body) {
    if (error) errors.push(error);

    if (!error ||
        error.class === ERRORS.INVALID_LICENSE ||
        attempts >= max) {
      dumpErrors(errors, 'connect');
      return callback(error, response, body);
    }

    var backoff = BACKOFFS[attempts - 1];
    if (backoff.warn) {
      logger.warn(
        "No connection has been established to New Relic after %s attempts.",
        attempts
      );
    }

    logger.debug(
      "Failed attempting to connect to New Relic, waiting %ss to retry.",
      backoff.interval
    );

    attempts++;

    setTimeout(function again() { api._login(retry); }, backoff.interval * TO_MILLIS);
  }

  this._login(retry);
};

CollectorAPI.prototype._login = function _login(callback) {
  var methods = this._methods
    , agent   = this._agent
    ;

  methods.redirect.call(null, function (error, collector, body) {
    if (error) return callback(error, collector, body);
    if (!collector) {
      logger.error(
        "Requesting this account's collector from %s failed; trying default.",
        agent.config.host
      );
    }
    else {
      logger.debug(
        "Requesting this account's collector from %s returned %s; reconfiguring.",
        agent.config.host,
        collector
      );
      agent.config.host = collector;
    }

    // The collector really likes arrays.
    // In fact, it kind of insists on them.
    var environment = [facts(agent)];

    methods.handshake.call(environment, function (error, response, body) {
      if (error) return callback(error, response, body);
      if (!response || !response.agent_run_id) {
        return callback(new Error("No agent run ID received from handshake."), response);
      }

      logger.info(
        "Connected to %s:%d with agent run ID %s.",
        agent.config.host,
        agent.config.port,
        response.agent_run_id
      );

      callback(null, response, body);
    });
  });
};

CollectorAPI.prototype.errorData = function errorData(errors, callback) {
  if (!errors) throw new TypeError("must pass error collection to send");
  if (!callback) throw new TypeError("callback is required");
  if (!errors.length) {
    logger.debug("No errors to send.");
    return process.nextTick(function () { callback(null, null, null); });
  }

  this._runLifecycle(this._methods.errors, errors, callback);
};

CollectorAPI.prototype.metricData = function metricData(metrics, callback) {
  if (!metrics) throw new TypeError("must pass metrics collection to send");
  if (!callback) throw new TypeError("callback is required");
  if (!metrics.toJSON().length) {
    logger.debug("No metric data to send.");
    return process.nextTick(function () { callback(null, null, null); });
  }

  this._runLifecycle(this._methods.metrics, metrics, callback);
};

CollectorAPI.prototype.transactionSampleData =
  function transactionSampleData(traces, callback) {
  if (!traces) throw new TypeError("must pass slow trace data to send");
  if (!callback) throw new TypeError("callback is required");
  if (traces.length < 1) {
    logger.debug("No slow trace to send.");
    return process.nextTick(function () { callback(null, null, null); });
  }

  this._runLifecycle(this._methods.traces, traces, callback);
};

CollectorAPI.prototype.sqlTraceData = function sqlTraceData(sqls, callback) {
  if (!sqls) throw new TypeError("must pass slow SQL to send");
  if (!callback) throw new TypeError("callback is required");
  if (!sqls.length) {
    logger.debug("No slow SQL to send.");
    return process.nextTick(function () { callback(null, null, null); });
  }

  this._runLifecycle(this._methods.sqls, sqls, callback);
};

/**
 * Sends no data aside from the message itself. Clears the run ID, which
 * effectively disconnects the agent from the collector.
 *
 * @param Function callback Runs after the run ID has been cleared.
 */
CollectorAPI.prototype.shutdown = function shutdown(callback) {
  if (!callback) throw new TypeError("callback is required");

  var agent = this._agent;
  this._methods.shutdown.call(null, function closed(error, returned, body) {
    if (error) {
      dumpErrors([error], 'shutdown');
    }
    else {
      logger.info(
        "Disconnected from New Relic; clearing run ID %s.",
        agent.config.run_id
      );
      agent.config.run_id = undefined;
    }

    callback(error, returned, body);
  });
};

CollectorAPI.prototype._restart = function _restart(callback) {
  var api = this;
  this.shutdown(function reconnect() { api.connect(callback); });
};

CollectorAPI.prototype._runLifecycle = function _runLifecycle(method, body, callback) {
  if (!this.isConnected()) {
    logger.warn("Not connected to New Relic. Not calling.", method.name);
    return callback(new Error("Not connected to collector.", null, null));
  }

  var api = this;
  function standardHandler(error, returned, json) {
    if (!error) return callback(error, returned, json);

    dumpErrors([error], method.name);

    if (error.statusCode === HTTP_REQUEST_TOO_LARGE) {
      logger.error(
        error,
        "This agent sent the New Relic collector too much data; discarding for %s (%s):",
        method.name,
        HTTP_REQUEST_TOO_LARGE
      );
      return callback(null, returned, json);
    }
    else if (error.statusCode === HTTP_UNSUPPORTED_MEDIA_TYPE) {
      logger.error(
        error,
        "The New Relic collector couldn't deserialize data; discarding for %s (%s):",
        method.name,
        HTTP_UNSUPPORTED_MEDIA_TYPE
      );
      return callback(null, returned, json);
    }
    else if (error.statusCode === HTTP_LOL_COLLECTOR) {
      logger.warn(
        error,
        "New Relic is experiencing a spot of bother; please hold on (%s):",
        method.name,
        HTTP_LOL_COLLECTOR
      );
      return callback(error, returned, json);
    }
    else if (error.class === ERRORS.RESTART) {
      logger.warn(
        error,
        "The New Relic collector requested a connection restart on %s:",
        method.name
      );

      return api._restart(function () { method.call(body, standardHandler); });
    }
    else if (error.class === ERRORS.DISCONNECT) {
      logger.error(error, "The New Relic collector is shutting down this agent:");

      return api._agent.stop(function () { callback(error, returned, json); });
    }
    else if (error.class === ERRORS.MAINTENANCE) {
      logger.info(
        error,
        "The New Relic server for your account is currently undergoing maintenance. " +
          "Data will be held until it can be submitted (failed on %s):",
        method.name
      );
      return callback(error, returned, json);
    }
    else if (error.class === ERRORS.RUNTIME) {
      logger.warn(
        error,
        "Calling %s on New Relic failed due to a runtime error. " +
          "Data will be held until it can be submitted:",
        method.name
      );
      return callback(error, returned, json);
    }
    else {
      logger.error(
        error,
        "Calling %s on New Relic failed unexpectedly. " +
          "Data will be held until it can be submitted:",
        method.name
      );
      return callback(error, returned, json);
    }
  }

  method.call(body, standardHandler);
};

CollectorAPI.prototype.isConnected = function isConnected() {
  return !!this._agent.config.run_id;
};

module.exports = CollectorAPI;
