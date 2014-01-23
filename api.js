'use strict';

var path   = require('path')
  , util   = require('util')
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
 * Tell the tracer whether to ignore the current transaction. The most common
 * use for this will be to mark a transaction as ignored (maybe it's handling
 * a websocket polling channel, or maybe it's an external call you don't care
 * is slow), but it's also useful when you want a transaction that would
 * otherwise be ignored due to URL or transaction name normalization rules
 * to *not* be ignored.
 *
 * @param {boolean} ignored Ignore, or don't ignore, the current transaction.
 */
API.prototype.setIgnoreTransaction = function (ignored) {
  var transaction = this.agent.tracer.getTransaction();
  if (!transaction) {
    return logger.warn("No transaction found to ignore.");
  }

  transaction.forceIgnore = ignored;
};

/**
 * Send errors to New Relic that you've already handled yourself. Should
 * be an Error or one of its subtypes, but the API will handle strings
 * and objects that have an attached .message or .stack property.
 *
 * @param {Error} error The error to be traced.
 */
API.prototype.noticeError = function (error) {
  var transaction = this.agent.tracer.getTransaction();
  this.agent.errors.add(transaction, error);
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

  this.agent.userNormalizer.addSimple(pattern, '/' + name);
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

  this.agent.userNormalizer.addSimple(pattern, null);
};

function obfuscate(string, license_key) {
  var bytes = new Buffer(string);
  var i;
  for (i = 0; i < bytes.length; i++)
    bytes[i] = bytes[i] ^ license_key[i % 13].charCodeAt(0);
  return bytes.toString('base64');
}

var _rum_stub = "<script type='text/javascript'>window.NREUM||(NREUM={});" + 
                "NREUM.info = %s; %s</script>";

/**
 * Get the <script>...</script> header necessary for Real User Monitoring (RUM)
 * This script must be manually injected into your templates, as high as possible
 * in the header, but _after_ any X-UA-COMPATIBLE HTTP-EQUIV meta tags.
 * Otherwise you may hurt IE!
 * 
 * This method must be called _during_ a transaction, and must be called every
 * time you want to generate the headers.
 *
 * Do *not* reuse the headers between users, or even between requests.
 */
API.prototype.getRUMHeader = function () {
  
  // gracefully fail
  // output an HTML comment and log a warning
  // the comment is meant to be innocuous to the end user
  function _gracefail(msg){
    logger.warn('rum:', msg);
    return '<!-- why is the rum gone? -->';
  }

  var trans = this.agent.getTransaction();

  // bail gracefully outside a transaction
  if (!trans) 
    return _gracefail('transaction missing while generating RUM headers');

  var conf  = this.agent.config;
  var rum   = conf.rum;

  // conf.rum should always exist, but we don't want the agent to bail
  // here if something goes wrong
  if (!rum)
    return _gracefail('conf.rum missing, something is probably wrong');

  var name  = trans.partialName;

  // if we're in an unnamed transaction, add a friendly warning
  // this is to avoid people going crazy, trying to figure out
  // why RUM is not working when they're missing a transaction name
  if (!name) 
    return _gracefail('rum headers need a transaction name');

  var time  = trans.timer.getDurationInMillis();
  var key   = conf.license_key;

  // this hash gets written directly into the browser
  var rum_hash = {
    agent           : rum.js_agent_file,
    beacon          : rum.beacon,
    errorBeacon     : rum.error_beacon,
    licenseKey      : rum.browser_key,
    applicationID   : conf.application_id,
    applicationTime : time,
    transactionName : obfuscate(name, key),

    // we don't use these parameters yet
    queueTime       : 0,
    agentToken      : null,
    ttGuid          : ""
  };

  var out = util.format(_rum_stub , JSON.stringify(rum_hash), rum.js_agent_loader);   
  
  logger.trace('generating RUM header', out);

  return out;
};

module.exports = API;
