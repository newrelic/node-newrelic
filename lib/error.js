'use strict';

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

function ignoreStatusCode() {
  // FIXME: this should clearly be doing something
  return false;
}

function ErrorService(config) {
  this.config = config;

  this.errorCount = 0;
  this.errors = [];
}

ErrorService.prototype.clear = function () {
  this.errors = [];
};

ErrorService.prototype.onTransactionFinished = function (transaction) {
  if (!transaction) throw new Error("Error service was passed a blank transaction.");

  var ignoreStatusCodes = this.config.error_collector.ignore_status_codes;

  var code = transaction.statusCode;
  if (code && code >= 400 && !ignoreStatusCode(code)) {
    if (ignoreStatusCodes.indexOf(transaction.statusCode) >= 0) return;

    this.errorCount++;
    if (this.errors.length < MAX_ERRORS) this.errors.push(createError(transaction));
  }
};

ErrorService.prototype.onSendError = function (_errors) {
  var len = Math.min(_errors.length, MAX_ERRORS - this.errors.length);

  for (var i = 0; i < len; i++) {
    this.errors.push(_errors[i]);
  }
};

module.exports = ErrorService;
