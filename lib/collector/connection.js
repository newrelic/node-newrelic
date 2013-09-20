'use strict';

var path       = require('path')
  , os         = require('os')
  , events     = require('events')
  , util       = require('util')
  , logger     = require(path.join(__dirname, '..', 'logger'))
      .child({component : 'connection'})
  , DataSender = require(path.join(__dirname, 'data-sender'))
  ;

/*
 *
 * CONSTANTS
 *
 */
var FROM_MILLIS = 1000;


function hasError(error, value) {
  return error &&
         error.error_type &&
         error.error_type === 'NewRelic::Agent::' + value;
}

function isRestart(error) {
  return hasError(error, 'ForceRestartException');
}

function isDisconnect(error) {
  return hasError(error, 'ForceDisconnectException');
}

function hasBadLicense(error) {
  return hasError(error, 'LicenseException');
}

function isMaintenance(error) {
  return hasError(error, 'MaintenanceError');
}

function isRuntime(error) {
  return error &&
         error.error_type &&
         error.error_type === 'RuntimeError';
}

function snakeToCamel(string) {
  return string.replace(/_(\w)/g, function (match, letter) {
    return letter.toUpperCase();
  });
}

/**
 * Exposes the set of messages the agent can send the collector, as well as
 * providing an observable, evented connection.
 */
function CollectorConnection(agent) {
  events.EventEmitter.call(this);

  if (!agent) throw new Error("collector connection requires agent!");

  this.agent = agent;

  this.on('error', this.onError.bind(this));
}
util.inherits(CollectorConnection, events.EventEmitter);

CollectorConnection.prototype.isConnected = function () {
  return this.agent.config.run_id ? true : false;
};

/**
 **
 ** COMMANDS
 **
 **/

/**
 * Start the process of connecting to the collector by requesting the
 * correct collector host from the collector proxy. Async.
 *
 * connect() -> onRedirectResponse() -> onHandshakeResponse() --> emit 'connect'
 */
CollectorConnection.prototype.connect = function () {
  this.once('connectResponse', this.onRedirectResponse.bind(this));
  this.once('connectError', this.onRedirectError.bind(this));
  this.send('get_redirect_host', null, 'connect');
};

/**
 * Start the process of shutting down the connection by sending the
 * shutdown command to the collector. Async.
 */
CollectorConnection.prototype.end = function () {
  this.sendShutdown();
  this.emit('end');
};

/**
 * In theory, we could reuse a connection once destroy has been called,
 * but it retains so little state that we might as well just create a
 * new one. Immediate.
 */
CollectorConnection.prototype.destroy = function () {
  logger.info("Destroyed New Relic connection for agent run ID %s.",
              this.agent.config.run_id);
  this.agent.config.run_id = null;
};

/**
 * Test whether a status code is one that requires accumulated data to be
 * discarded rather than re-aggregated.
 *
 * Current status codes that trigger data discarding are
 *
 *   413: Request was too big.
 *   415: Serialization error (as a side note, something is up if the collector
 *        can't deserialize data coming out of V8's JSON.stringify).
 *
 * @param {number} statusCode The code to be tested.
 *
 * @return {boolean} Whether or not to discard saved data.
 */
CollectorConnection.prototype.discard = function (statusCode) {
  return (statusCode === 413 || statusCode === 415);
};

/**
 **
 ** COLLECTOR API
 **
 ** See Collector javadocs for details. All of these methods are
 ** async.
 **
 **/

CollectorConnection.prototype.sendTracedErrors = function (errors) {
  if (!errors) throw new TypeError("must pass error collection to send");
  if (!errors.length) return logger.debug("No errors to send.");

  if (!this.isConnected()) {
    return logger.warn("Not connected to New Relic. Not sending noticed errors.");
  }

  var data = [this.agent.config.run_id, errors];
  this.send('error_data', data);
};

CollectorConnection.prototype.sendMetricData = function (metrics) {
  if (!metrics) throw new TypeError("must pass metrics collection to send");
  if (!metrics.toJSON().length) return logger.debug("No metric data to send.");

  if (!this.isConnected()) {
    return logger.warn("Not connected to New Relic. Not sending metric data.");
  }

  var beginMillis = metrics.started / FROM_MILLIS
    , endMillis   = Date.now() / FROM_MILLIS
    , data        = [this.agent.config.run_id, beginMillis, endMillis, metrics]
    ;
  this.send('metric_data', data);
};

CollectorConnection.prototype.sendTransactionTraces = function (traces) {
  if (!traces) throw new TypeError("must pass slow trace data to send");
  if (!traces[0]) return logger.debug("No slow trace to send.");

  if (!this.isConnected()) {
    return logger.warn("Not connected to New Relic. Not sending slow trace.");
  }

  var data = [this.agent.config.run_id, traces];
  this.send('transaction_sample_data', data);
};

CollectorConnection.prototype.sendSQLTraces = function (sqls) {
  if (!sqls) throw new TypeError("must pass slow SQL to send");
  if (!sqls.length) return logger.debug("No slow SQL to send.");

  if (!this.isConnected()) {
    return logger.warn("Not connected to New Relic. Not sending slow SQL.");
  }

  this.send('sql_trace_data', sqls);
};

/**
 * Sends no data aside from the message itself, and also requires some
 * special-casing when dealing with the data sender it uses, because
 * shutdown returning an error is the expected case.
 */
CollectorConnection.prototype.sendShutdown = function () {
  if (!this.isConnected()) {
    return logger.info("Not connected to New Relic. " +
                       "Not attempting to shut down connection.");
  }

  this.send('shutdown');
};

/**
 * Bridges data coming back from the data sender delegates. Handles the
 * special-case logic for the shutdown command, otherwise generates event
 * names based on the methodName provided.
 *
 * Need this method around to support mockable testing. It's the only
 * function that uses the DataSenders or performs I/O.
 *
 * @param {string} methodName The message being invoked remotely. Used to
 *                            map responses to event names, so don't change
 *                            the method names without care, as you can break
 *                            the agent, which is observing those events.
 * @param {object} data       Data, if any, to be sent to the collector.
 * @param {string} message    (Optional) User-friendly name for method. Used
 *                            to generate event names. Will be automatically
 *                            generated from methodName, transforming
 *                            snake_case to camelCase, if omitted.
 */
CollectorConnection.prototype.send = function (methodName, data, message) {
  var sender = new DataSender(this.agent.config);
  if (!message) message = snakeToCamel(methodName);

  if (message === 'shutdown') {
    sender.on('response', function (response) {
      // observers might want to know when shutdown is handled
      this.once('shutdown', this.onShutdown.bind(this));
      this.emit('shutdown', response);
    }.bind(this));
  }
  else {
    sender.on('response', function (response) {
      this.emit(message + 'Response', response);
    }.bind(this));

    // Some of the errors have special types -- be sure to handle them
    sender.once('error', this.onNRException.bind(this));
  }

  sender.on('error', function (remoteName, error) {
    this.emit('error', message, remoteName, error);
    this.emit(message + 'Error', data, error);
  }.bind(this));

  sender.invokeMethod(methodName, data);
};

/**
 **
 ** EVENT HANDLERS
 **
 **/

CollectorConnection.prototype.onError = function (methodName, remoteName, error) {
  logger.debug(error,
               "An error occurred sending message %s (remote name %s):",
               methodName,
               remoteName);
};

/**
 * Only nuke the connection after we've received an acknowledgment from the
 * collector that the connection has been shut down.
 *
 * @param error error Should be the ForceRestartException we're expecting.
 */
CollectorConnection.prototype.onShutdown = function () {
  logger.info("Connection to New Relic terminated.");
  this.destroy();
  this.emit('close');
};

CollectorConnection.prototype.onHandshakeError = function (data, error) {
  logger.warn(error,
              "Redirect succeeded, but handshake failed with response %s.",
              data);

  this.removeAllListeners('handshakeResponse');
  this.removeAllListeners('handshakeError');

  this.emit('connectError', data, error);
};

/**
 * Successfully(?) conclude the connection process.
 */
CollectorConnection.prototype.onHandshakeResponse = function (response) {
  if (response.agent_run_id) {
    logger.info("Connected to %s:%d with agent run ID %s.",
                this.agent.config.host,
                this.agent.config.port,
                response.agent_run_id);

    this.removeAllListeners('handshakeError');
    this.emit('connect', response);
  }
  else {
    this.emit('handshakeError',
              response,
              new Error('No agent run ID received from handshake.'));
  }
};

/**
 * The next step in the collector connection process -- performs the initial
 * handshake with the actual collector after obtaining a redirect host from
 * the collector proxy.
 */
CollectorConnection.prototype.onRedirectResponse = function (redirectHost) {
  if (redirectHost) {
    logger.debug("Redirected from %s to %s.", this.agent.config.host, redirectHost);
    this.agent.config.host = redirectHost;
  }
  else {
    logger.error("Fetching redirect collector host failed; trying default.");
  }

  var applications = this.agent.config.applications()
    , hostname     = os.hostname()
    ;

  var options = {
    pid           : process.pid,
    host          : hostname,
    language      : 'nodejs',
    app_name      : applications,
    agent_version : this.agent.version,
    environment   : this.agent.environment
  };

  var data = [options];
  this.once('handshakeResponse', this.onHandshakeResponse.bind(this));
  this.once('handshakeError',    this.onHandshakeError.bind(this));
  this.send('connect', data, 'handshake');
};

/**
 * Don't want to keep accumulating handlers to the redirect cycle.
 */
CollectorConnection.prototype.onRedirectError = function (data, error) {
  if (error) logger.warn(error, "Error connecting to %s:", this.agent.config.host);
  this.removeAllListeners('redirectResponse');
};

/**
 * Handle the two most common exceptions returned by the collector.
 */
CollectorConnection.prototype.onNRException = function (method, error) {
  if (isRestart(error) && this.isConnected()) {
    logger.debug("New Relic wants the agent to reconnect.");
    this.agent.emit('restart');
  }
  else if (isDisconnect(error) && this.isConnected()) {
    logger.debug("New Relic has instructed this agent to shut down: %s",
                 error.message);
    this.agent.emit('shutdown');
  }
  else if (hasBadLicense(error)) {
    logger.error("A valid account license key cannot be found. " +
                 "Has a license key been specified in the agent configuration " +
                 "file or via the NEW_RELIC_LICENSE_KEY environment variable?");
  }
  else if (isMaintenance(error)) {
    logger.error("The New Relic server for your account is currently " +
                 "unavailable. Data will be held until it can be submitted: %s",
                 error.message);
  }
  else if (isRuntime(error)) {
    logger.error("New Relic's servers are currently unavailable due to a " +
                 "runtime error. Data will be held until it can be submitted: %s",
                 error.message);
  }
};

module.exports = CollectorConnection;
