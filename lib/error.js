'use strict';

var path   = require('path')
  , logger = require(path.join(__dirname, 'logger')).child({component : 'error_service'})
  ;

var MAX_ERRORS = 20;

/**
 * Given either or both of a transaction and an exception, generate an error
 * trace in the JSON format expected by the collector. Since this will be
 * used by both the HTTP instrumentation, which uses HTTP status codes to
 * determine whether a transaction is in error, and the domain-based error
 * handler, which traps actual instances of Error, try to set sensible
 * defaults for everything.
 *
 * @param Transaction transaction The agent transaction, presumably coming out
 *                                of the instrumentation.
 * @param Error exception Something trapped by an error listener.
 */
function createError(transaction, exception) {
  // the collector throws this out, so don't bother setting it
  var timestamp = 0;

  var scope = 'Unknown';
  if (transaction && transaction.scope) scope = transaction.scope;

  var message;
  if (exception && exception.message) {
    message = exception.message;
  }
  else {
    var code = '';
    code += (transaction && transaction.statusCode) || 500;

    message = "HttpError " + code;
  }

  var type = message;
  if (exception && exception.constructor && exception.constructor.name) {
    type = exception.constructor.name;
  }

  // FIXME add request_params, custom_params
  var params = {};
  if (transaction && transaction.url) params = {request_uri : transaction.url};

  return [timestamp,
          scope,
          message,
          type,
          params];
}

/**
 * This isn't really a service, it's a fairly simple-minded adapter that
 * converts errored-out HTTP transactions and JS Errors into the error traces
 * expected by the collector.
 *
 * It also acts as a container for the traced errors.
 */
function ErrorService(config) {
  this.config = config;
  this.clear();
}

/**
 * (Re)Initialize the tracer.
 *
 * FIXME: for consistency's sake, it would be good to replace the error handler
 * between request cycles.
 */
ErrorService.prototype.clear = function () {
  this.errorCount = 0;
  this.errors = [];
};

ErrorService.prototype.ignoreStatusCode = function (code) {
  var codes = this.config.error_collector.ignore_status_codes || [];
  return codes.indexOf(code) !== -1;
};

/**
 * Every finished transaction goes through this handler, so do as
 * little as possible.
 */
ErrorService.prototype.onTransactionFinished = function (transaction) {
  if (!transaction) throw new Error("Error service got a blank transaction.");

  var code = transaction.statusCode;
  if (code && code >= 400 && !this.ignoreStatusCode(code)) this.add(transaction);
};

ErrorService.prototype.add = function (transaction, exception) {
  this.errorCount++;

  // allow enabling & disabling the error tracer at runtime
  if (this.config.error_collector && !this.config.error_collector.enabled) return;

  if (exception) logger.trace(exception, "Got exception to trace:");

  var error = createError(transaction, exception);
  if (this.errors.length < MAX_ERRORS) {
    logger.debug({error : error}, "Error to be sent to collector:");
    this.errors.push(error);
  }
  else {
    logger.debug("Already have %d errors to send to collector, not logging.",
                 MAX_ERRORS);
    logger.trace({error : error}, "JSON error.");
  }
};

/**
 * If the connection to the collector fails, retain as many as will fit
 * without overflowing the current error list.
 */
ErrorService.prototype.onSendError = function (errors) {
  var len = Math.min(errors.length, MAX_ERRORS - this.errors.length);

  for (var i = 0; i < len; i++) {
    this.errors.push(errors[i]);
  }
};

module.exports = ErrorService;
