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
API.prototype.setTransactionName = function (name) {
  var transaction = this.agent.tracer.getTransaction();
  if (!transaction) {
    return logger.warn("No transaction found when setting name to '%s'.", name);
  }

  if (!name) {
    if (transaction && transaction.url) {
      logger.error("Must include name in setTransactionName call for URL %s.",
                   transaction.url);
    }
    else {
      logger.error("Must include name in setTransactionName call.");
    }

    return;
  }

  transaction.partialName = NAMES.CUSTOM + '/' + name;
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
API.prototype.setControllerName = function (name, action) {
  var transaction = this.agent.tracer.getTransaction();
  if (!transaction) {
    return logger.warn("No transaction found when setting controller to %s.", name);
  }

  if (!name) {
    if (transaction && transaction.url) {
      logger.error("Must include name in setControllerName call for URL %s.",
                   transaction.url);
    }
    else {
      logger.error("Must include name in setControllerName call.");
    }

    return;
  }

  action = action || transaction.verb || 'GET';
  transaction.partialName = NAMES.CONTROLLER + '/' + name + '/' + action;
};

/**
 * If the URL for a transaction matches the provided pattern, name the
 * transaction with the provided name. If there are capture groups in the
 * pattern (which is a standard JavaScript regular expression, and can be
 * passed as either a RegExp or a string), then the substring matches ($1, $2,
 * etc.) are replaced in the name string. BE CAREFUL WHEN USING SUBSTITUTION.
 * If the replacement substrings are highly variable (i.e. are identifiers,
 * GUIDs, or timestamps), the rule will generate too many metrics and
 * potentially get your application blacklisted by New Relic.
 *
 * An example of a good rule with replacements:
 *
 *   newrelic.addNamingRule('^/storefront/(v[1-5])/(item|category|tag)',
 *                          'CommerceAPI/$1/$2')
 *
 * An example of a bad rule with replacements:
 *
 *   newrelic.addNamingRule('^/item/([0-9a-f]+)', 'Item/$1')
 *
 * Keep in mind that the original URL and any query parameters will be sent
 * along with the request, so slow transactions will still be identifiable.
 *
 * Naming rules can not be removed once added. They can also be added via the
 * agent's configuration. See configuration documentation for details.
 *
 * @param {RegExp} pattern The pattern to rename (with capture groups).
 * @param {string} name    The name to use for the transaction.
 */
API.prototype.addNamingRule = function (pattern, name) {
  if (!name) return logger.error("Simple naming rules require a replacement name.");

  this.agent.urlNormalizer.addSimple(pattern, '/' + name);
};

/**
 * If the URL for a transaction matches the provided pattern, ignore the
 * transaction attached to that URL. Useful for filtering socket.io connections
 * and other long-polling requests out of your agents to keep them from
 * distorting an app's apdex or mean response time. Pattern may be a (standard
 * JavaScript) RegExp or a string.
 *
 * Example:
 *
 *   newrelic.addIgnoringRule('^/socket\\.io/')
 *
 * @param {RegExp} pattern The pattern to ignore.
 */
API.prototype.addIgnoringRule = function (pattern) {
  if (!pattern) return logger.error("Must include a URL pattern to ignore.");

  this.agent.urlNormalizer.addSimple(pattern, null);
};

module.exports = API;
