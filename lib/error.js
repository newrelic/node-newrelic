'use strict';

var path   = require('path')
  , logger = require(path.join(__dirname, 'logger')).child({component : 'error_service'})
  ;

var MAX_ERRORS = 20;

function createError(transaction, exception) {
  // the collector throws this out
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
  if (!transaction) throw new Error("Error service got a blank transaction.");

  var code = transaction.statusCode;
  if (code && code >= 400 && !this.ignoreStatusCode(code)) this.add(transaction);
};

ErrorService.prototype.add = function (transaction, exception) {
  if (exception) logger.trace(exception, "Got error to trace.");
  this.errorCount++;

  var error = createError(transaction, exception);
  if (this.errors.length < MAX_ERRORS) {
    logger.debug("Adding error: %j", error);
    this.errors.push(error);
  }
};

ErrorService.prototype.onSendError = function (errors) {
  var len = Math.min(errors.length, MAX_ERRORS - this.errors.length);

  for (var i = 0; i < len; i++) {
    this.errors.push(errors[i]);
  }
};

module.exports = ErrorService;
