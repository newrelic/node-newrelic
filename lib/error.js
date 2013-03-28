'use strict';

var path   = require('path')
  , logger = require(path.join(__dirname, 'logger')).child({component : 'error_tracer'})
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
    message = 'HttpError ' + ((transaction && transaction.statusCode) || 500);
  }

  var type = message;
  if (exception && exception.constructor && exception.constructor.name) {
    type = exception.constructor.name;
  }

  var stack = exception && exception.stack;

  // FIXME add request_params, custom_params
  var params = {};
  if (transaction && transaction.url) params = {request_uri : transaction.url};

  return [timestamp,
          scope,
          (stack || message),
          type,
          params];
}

/**
 * This is a fairly simple-minded tracer that converts errored-out HTTP
 * transactions and JS Errors into the error traces expected by the collector.
 *
 * It also acts as a collector for the traced errors.
 */
function ErrorTracer(config) {
  this.config = config;
  this.clear();
}

/**
 * (Re)Initialize the tracer.
 *
 * FIXME: for consistency's sake, it would be good to replace the error handler
 * between request cycles.
 */
ErrorTracer.prototype.clear = function () {
  this.errorCount = 0;
  this.errors = [];
};

ErrorTracer.prototype.ignoreStatusCode = function (code) {
  var codes = this.config.error_collector.ignore_status_codes || [];
  return codes.indexOf(code) !== -1;
};

/**
 * Every finished transaction goes through this handler, so do as
 * little as possible.
 */
ErrorTracer.prototype.onTransactionFinished = function (transaction) {
  if (!transaction) throw new Error("Error collector got a blank transaction.");

  var code = transaction.statusCode;
  if (transaction.exceptions.length > 0) {
    transaction.exceptions.forEach(function (exception) {
      this.add(transaction, exception);
    }.bind(this));
  }
  else if (code && code >= 400 && !this.ignoreStatusCode(code)) {
    this.add(transaction);
  }
};

/**
 * This function uses error.__NR_CAUGHT to ensure errors don't get
 * double-counted. It can also be used as an unofficial means of marking that
 * user errors shouldn't be traced.
 *
 * NOTE: this interface is unofficial and may change in future.
 */
ErrorTracer.prototype.add = function (transaction, exception) {
  if (exception && exception.__NR_CAUGHT) return;

  this.errorCount++;

  // allow enabling & disabling the error tracer at runtime
  if (this.config.error_collector && !this.config.error_collector.enabled) return;

  if (exception) {
    logger.trace(exception, "Got exception to trace:");
    exception.__NR_CAUGHT = true;
  }

  var error = createError(transaction, exception);
  if (this.errors.length < MAX_ERRORS) {
    logger.debug({error : error}, "Error to be sent to collector:");
    this.errors.push(error);
  }
  else {
    logger.debug("Already have %d errors to send to collector, not keeping.",
                 MAX_ERRORS);
    logger.trace({error : error}, "JSON error.");
  }
};

/**
 * In an effort to trap more synchronous exceptions before instrumented
 * frameworks get their claws into them, this function runs a wrapped
 * function, collecting any exceptions that are thrown, and then rethrowing
 * the exception in an effort to not change how user apps see errors.
 *
 * @param Function monitored      The function to be called.
 * @param Transaction transaction The NR context for the call.
 */
ErrorTracer.prototype.monitor = function (monitored, transaction) {
  if (typeof monitored !== 'function') {
    throw new Error("First parameter of monitor must be a function!");
  }

  try {
    return monitored();
  }
  catch (error) {
    this.add(transaction, error);
    if (process.domain) {
      process.domain.emit('error', error);
    }
    else {
      throw error;
    }
  }
};

/**
 * If the connection to the collector fails, retain as many as will fit without
 * overflowing the current error list.
 *
 * @param array errors Previously harvested errors.
 * @param error error  Cause of the send error.
 */
ErrorTracer.prototype.onSendError = function (errors, error) {
  var len = Math.min(errors.length, MAX_ERRORS - this.errors.length);
  for (var i = 0; i < len; i++) this.errors.push(errors[i]);

  if (error) {
    logger.warn(error,
                "Adding %s errors for next harvest because harvest failed. Reason:",
                len);
  }
};

module.exports = ErrorTracer;
