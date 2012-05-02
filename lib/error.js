var path  = require('path')
  , trace = require(path.join(__dirname, 'trace'))
  ;

var MAX_ERRORS = 20;

function createError(transaction) {
  var message = transaction.statusMessage;
  if (!message) {
    message = "HttpError " + transaction.statusCode;
  }

  var params = {'request_uri': transaction.url};
  // FIXME request_params, custom_params

  var timestamp = 0; // the collector throws this out
  return [timestamp,
          transaction.scope,
          message,
          message, // exception class
          params];
}

function ErrorService(logger, config) {
  this.logger = logger;
  this.config = config;

  this.errorCount = 0;
  this.errors = [];

  trace.addTransactionListener(this, this.onTransactionFinished);
}

ErrorService.prototype.onBeforeHarvest = function (statsEngine, nrService) {
  statsEngine.unscopedStats.byName("Errors/all").incrementCallCount(this.errorCount);
  nrService.sendTracedErrors(this.errors);
  this.errors = [];
};

ErrorService.prototype.onTransactionFinished = function (transaction) {
  if (!transaction) return;

  var self = this;

  var ignoreStatusCodes = self.config.error_collector.ignore_status_codes;
  function noticeError(transaction) {
    if (ignoreStatusCodes.indexOf(transaction.statusCode) >= 0) return;

    self.errorCount++;
    if (self.errors.length < MAX_ERRORS) {
      self.logger.debug("Capturing traced error");
      self.errors.push(createError(transaction));
    }
  }

  function ignoreStatusCode() {
    return false;
  }

  var code = transaction.statusCode;
  if (code && code >= 400 && !ignoreStatusCode(code)) noticeError(transaction);
};

ErrorService.prototype.onSendError = function (_errors) {
  var len = Math.min(_errors.length, MAX_ERRORS - this.errors.length);
  for (var i = 0; i < len; i++) {
    this.errors.push(_errors[i]);
  }
};

exports.ErrorService = ErrorService;
