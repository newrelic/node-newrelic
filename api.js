'use strict';

var path   = require('path')
  , logger = require(path.join(__dirname, 'lib', 'logger')).child({component : 'api'})
  , NAMES  = require(path.join(__dirname, 'lib', 'metrics', 'names'))
  ;

/**
 * The exported New Relic API. This contains all of the functions meant to be
 * used by New Relic customers. For now, that means transaction naming.
 */
function API(agent) {
  this.agent = agent;
}

/**
 * Give the current transaction a custom name. Overrides any New Relic naming
 * rules set in configuration or from New Relic's servers.
 *
 * IMPORTANT: this function must be called when a transaction is active. New
 * Relic transactions are tied to web requests, so this method may be called
 * from within HTTP or HTTPS listener functions, Express routes, or other
 * contexts where a web request or response object are in scope.
 *
 * @param {string} name The name you want to give the web request in the New
 *                      Relic UI. Will be prefixed with 'Custom/' when sent.
 */
API.prototype.nameTransaction = function (name) {
  var transaction = this.agent.getTransaction();
  if (!transaction) {
    return logger.warn("no transaction found when setting name to %s", name);
  }

  if (!name) {
    if (transaction && transaction.url) {
      logger.error("must include controller name in nameTransaction call for URL %s",
                   transaction.url);
    }
    else {
      logger.error("must include controller name in nameTransaction call");
    }

    return;
  }

  transaction.scope = NAMES.CUSTOM + '/' + name;
};

/**
 * Give the current transaction a name based on your own idea of what
 * constitutes a controller in your Node application. Also allows you to
 * optionally specify the action being invoked on the controller. If the action
 * is omitted, then the API will default to using the HTTP method used in the
 * request (e.g. GET, POST, DELETE). Overrides any New Relic naming rules set
 * in configuration or from New Relic's servers.
 *
 * IMPORTANT: this function must be called when a transaction is active. New
 * Relic transactions are tied to web requests, so this method may be called
 * from within HTTP or HTTPS listener functions, Express routes, or other
 * contexts where a web request or response object are in scope.
 *
 * @param {string} name   The name you want to give the controller in the New
 *                        Relic UI. Will be prefixed with 'Controller/' when
 *                        sent.
 * @param {string} action The action being invoked on the controller. Defaults
 *                        to the HTTP method used for the request.
 */
API.prototype.nameController = function (name, action) {
  var transaction = this.agent.getTransaction();
  if (!transaction) {
    return logger.warn("no transaction found when setting controller to %s", name);
  }

  if (!name) {
    if (transaction && transaction.url) {
      logger.error("must include controller name in nameController call for URL %s",
                   transaction.url);
    }
    else {
      logger.error("must include controller name in nameController call");
    }

    return;
  }

  action = action || transaction.verb || 'GET';
  transaction.scope = NAMES.CONTROLLER + '/' + name + '/' + action;
};

module.exports = API;
