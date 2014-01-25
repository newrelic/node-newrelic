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

function CollectorAPI(agent) {
  this._agent = agent;
}

CollectorAPI.prototype.connect = function connect(callback) {
  var api      = this
    , attempts = 1
    , max      = BACKOFFS.length
    ;

  function retry(error, response, body) {
    if (!error ||
        error.class === ERRORS.INVALID_LICENSE ||
        attempts >= max) {
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
  var agent = this._agent;

  var redirect  = new RemoteMethod('get_redirect_host', agent.config);
  var handshake = new RemoteMethod('connect',           agent.config);

  redirect.call(null, function (error, collector, body) {
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

    handshake.call(environment, function (error, response, body) {
      if (error) return callback(error, response, body);
      if (!response || !response.agent_run_id) {
        return callback(new Error('No agent run ID received from handshake.'), response);
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

module.exports = CollectorAPI;
