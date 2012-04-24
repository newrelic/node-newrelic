MAX_ERRORS = 20;

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
  var errorCount = 0;
  var errors = [];

  function ignoreStatusCode() {
    return false;
  }
  var ignoreStatusCodes = config.error_collector.ignore_status_codes;

  function noticeError(transaction) {
    if (ignoreStatusCodes.indexOf(transaction.statusCode) >= 0) return;

    errorCount++;
    if (errors.length < MAX_ERRORS) {
      logger.debug("Capturing traced error");
      errors.push(createError(transaction));
    }
  }

  // for testing
  this.getErrors = function () {
    return errors;
  };

  this.getErrorCount = function () {
    return errorCount;
  };

  this.onBeforeHarvest = function (statsEngine, nrService) {
    statsEngine.getUnscopedStats().getStats("Errors/all").incrementCallCount(errorCount);
    nrService.sendTracedErrors(errors);
    errors = [];
  };

  this.onTransactionFinished = function (transaction) {
    if (!transaction) return;

    var code = transaction.statusCode;
    if (code && code >= 400 && !ignoreStatusCode(code)) noticeError(transaction);
  };

  this.onSendError = function (_errors) {
    var len = Math.min(_errors.length, MAX_ERRORS - errors.length);
    for (var i = 0; i < len; i++) {
      errors.push(_errors[i]);
    }
  };
}


exports.ErrorService = ErrorService;

