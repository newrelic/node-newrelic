'use strict';

var path    = require('path')
  , urltils = require(path.join(__dirname, 'util', 'urltils'))
  , logger  = require(path.join(__dirname, 'logger')).child({component : 'error_tracer'})
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
  var timestamp = 0
    , name      = 'WebTransaction/Uri/*'
    , message   = ''
    , type      = 'Error'
    , params    = {}
    ;

  if (transaction && transaction.name) name = transaction.name;

  // NB: anything throwing / emitting strings is buggy, but it happens
  if (typeof exception === 'string') {
    message = exception;
  }
  else if (exception && exception.message) {
    message = exception.message;
    // only care about extracting the type if it's Error-like.
    if (exception && exception.constructor && exception.constructor.name) {
      type = exception.constructor.name;
    }
  }
  else if (transaction &&
           transaction.statusCode &&
           urltils.isError(transaction.agent.config, transaction.statusCode)) {
    message = 'HttpError ' + transaction.statusCode;
  }

  // FIXME add custom_params
  if (transaction && transaction.url) {
    var url        = transaction.url
      , statusCode = transaction.statusCode || 500
      ;

    /* We need a name for this transaction, but since error-tracing can happen
     * in the middle of the request, and it's possible that the user will
     * recover from the error, name the transaction now, preserving the
     * necessary state to maintain any user-provided naming information.
     */
    if (!transaction.name) {
      var partialName = transaction.partialName;
      transaction.setName(url, statusCode);
      transaction.partialName = partialName;
    }

    name = transaction.name;
    params.request_uri = url;
    if (transaction.agent.config.capture_params) {
      var requestParams = urltils.parseParameters(url);

      // clear out ignored params
      transaction.agent.config.ignored_params.forEach(function (k) {
        // polymorphic hidden classes aren't an issue with data bags
        delete requestParams[k];
      });

      if (Object.keys(requestParams).length > 0) params.request_params = requestParams;
    }
  }

  var stack = exception && exception.stack;
  // FIXME: doing this work should not be the agent's responsibility
  if (stack) params.stack_trace = ('' + stack).split(/[\n\r]/g);

  return [timestamp, name, message, type, params];
}

/**
 * This is a fairly simple-minded tracer that converts errored-out HTTP
 * transactions and JS Errors into the error traces expected by the collector.
 *
 * It also acts as a collector for the traced errors.
 */
function ErrorTracer(config) {
  this.config     = config;
  this.errorCount = 0;
  this.errors     = [];
  this.seen       = [];
}

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
    }, this);
  }
  else if (urltils.isError(this.config, code)) {
    this.add(transaction);
  }
};

/**
 * This function uses an array of seen exceptions to ensure errors don't get
 * double-counted. It can also be used as an unofficial means of marking that
 * user errors shouldn't be traced.
 *
 * NOTE: this interface is unofficial and may change in future.
 */
ErrorTracer.prototype.add = function (transaction, exception) {
  if (!exception) {
    if (!transaction) return;
    if (!transaction.statusCode) return;
    if (transaction.error) return;
  }
  else {
    if (this.seen.indexOf(exception) !== -1) return;
  }

  this.errorCount++;

  // allow enabling & disabling the error tracer at runtime
  if (!this.config.collect_errors ||
      !this.config.error_collector || !this.config.error_collector.enabled) return;

  if (exception) {
    logger.trace(exception, "Got exception to trace:");
    // put the error on the transaction to show we've already traced it
    if (transaction) transaction.error = exception;
    this.seen.push(exception);
  }

  if (this.errors.length < MAX_ERRORS) {
    var error = createError(transaction, exception);
    logger.debug({error : error}, "Error to be sent to collector:");
    this.errors.push(error);
  }
  else {
    logger.debug("Already have %d errors to send to collector, not keeping.",
                 MAX_ERRORS);
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
 */
ErrorTracer.prototype.merge = function (errors) {
  if (!errors) return;

  var len = Math.min(errors.length, MAX_ERRORS - this.errors.length);
  logger.warn("Merging %s (of %s) errors for next delivery.", len, errors.length);
  for (var i = 0; i < len; i++) this.errors.push(errors[i]);
};

module.exports = ErrorTracer;
