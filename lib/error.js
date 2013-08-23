'use strict';

var path   = require('path')
  , web    = require(path.join(__dirname, 'transaction', 'web'))
  , logger = require(path.join(__dirname, 'logger')).child({component : 'error_tracer'})
  , NAMES  = require(path.join(__dirname, 'metrics', 'names'))
  ;

var MAX_ERRORS = 20;

/**
 * Inside the error tracer, we don't know if the transaction is going to last
 * long enough to hit the main transaction naming and normalization process,
 * so go ahead and figure out the scope based on the current state of the
 * transaction.
 *
 * @param {MetricNormalizer} normalizer The current normalizer.
 * @param {string} url A URL path to normalize.
 *
 * @returns {string} A scope / transaction name.
 */
function quickNormalize(normalizer, url) {
  var path = web.scrubURL(url)
    , name = normalizer.normalize(path)
    ;

  if (name.normalized) {
    return NAMES.WEB + '/' + NAMES.NORMALIZED + name.normalized;
  }
  else {
    return NAMES.WEB + '/' + NAMES.URI + path;
  }
}

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
    , scope     = 'WebTransaction/Uri/*'
    , message   = ''
    , type      = 'Error'
    , params    = {}
    ;

  if (transaction && transaction.scope) scope = transaction.scope;

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
  else if (transaction && transaction.statusCode && transaction.statusCode >= 400) {
    message = 'HttpError ' + transaction.statusCode;
  }

  // FIXME add custom_params
  if (transaction && transaction.url) {
    var url        = transaction.url
      , normalizer = transaction.agent.normalizer
      ;

    if (transaction.scope) {
      scope = transaction.scope;
    }
    else {
      scope = quickNormalize(normalizer, url);
    }

    params.request_uri = url;
    var requestParams = web.getParametersFromURL(url);
    if (Object.keys(requestParams).length > 0) params.request_params = requestParams;
  }

  var stack = exception && exception.stack;
  // FIXME: doing this work should not be the agent's responsibility
  if (stack) params.stack_trace = ('' + stack).split(/[\n\r]/g);

  return [timestamp, scope, message, type, params];
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
 * The agent can be configured to ignore HTTP status codes for the error
 * tracer.
 *
 * @param {string} code The HTTP status code to check.
 *
 * @returns {bool} Whether the status code should be ignored.
 */
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
    }, this);
  }
  else if (code && code >= 400 && !this.ignoreStatusCode(code)) {
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
  }
  if (this.seen.indexOf(exception) !== -1) return;

  this.errorCount++;

  // allow enabling & disabling the error tracer at runtime
  if (this.config.error_collector && !this.config.error_collector.enabled) return;

  if (exception) {
    logger.trace(exception, "Got exception to trace:");
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
