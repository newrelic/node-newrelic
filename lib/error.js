'use strict';

var path   = require('path')
  , logger = require(path.join(__dirname, 'logger')).child({component : 'error_service'})
  ;

var MAX_ERRORS = 20;

function createError(transaction) {
  var message = transaction.statusMessage;
  if (!message) message = "HttpError " + transaction.statusCode;

  // FIXME add request_params, custom_params
  var params = {request_uri : transaction.url};

  // the collector throws this out
  var timestamp = 0;

  return [timestamp,
          transaction.scope,
          message,
          message, // exception class
          params];
}

function ErrorService(config) {
  this.config = config;

  this.errorCount = 0;
  this.errors = [];
}

ErrorService.prototype.clear = function () {
  this.errorCount = 0;
  this.errors = [];
};

ErrorService.prototype.ignoreStatusCode = function (code) {
  var codes = this.config.error_collector.ignore_status_codes;
  return codes.indexOf(code) !== -1;
};

ErrorService.prototype.onTransactionFinished = function (transaction) {
  if (!transaction) throw new Error("Error service was passed a blank transaction.");

  var code = transaction.statusCode;
  if (code && code >= 400 && !this.ignoreStatusCode(code)) {
    this.errorCount++;

    var error = createError(transaction);
    logger.trace("Adding error: %j", error);
    if (this.errors.length < MAX_ERRORS) this.errors.push(error);
  }
};

ErrorService.prototype.onSendError = function (errors) {
  var len = Math.min(errors.length, MAX_ERRORS - this.errors.length);

  for (var i = 0; i < len; i++) {
    this.errors.push(errors[i]);
  }
};

module.exports = ErrorService;
