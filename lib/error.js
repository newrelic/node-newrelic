
MAX_ERRORS = 20;

function TracedError(path, message, exceptionClass, params) {
	this.toJSON = function() {
		var timestamp = 0; // the collector throws this out
		return [timestamp, path, message, exceptionClass, params];
	};
}

function createError(transaction) {
	var message = transaction.statusMessage;
	if (!message) {
		message = "HttpError " + transaction.statusCode;
	}
	var params = {'request_uri': transaction.url};
	// FIXME request_params, custom_params
	
	return new TracedError(transaction.scope, message, message, params);
}

function ErrorService(logger, config) {
	var self = this;
	var errorCount = 0;
	var errors = [];
	function ignoreStatusCode() {
		return false;
	}
	var ignoreStatusCodes = config['error_collector']['ignore_status_codes'];
	
	function noticeError(transaction) {
		if (ignoreStatusCodes.indexOf(transaction.statusCode) >= 0) {
			return;
		}
		errorCount++;
		if (errors.length < MAX_ERRORS) {
			logger.debug("Capturing traced error");
			errors.push(createError(transaction));
		}
	}
	
	// for testing
	this.getErrors = function() {
		return errors;
	};
	
	this.getErrorCount = function() {
		return errorCount;
	};
	
	this.onBeforeHarvest = function(statsEngine, nrService) {
		statsEngine.getUnscopedStats().getStats("Errors/all").incrementCallCount(errorCount);
		// FIXME merge the errors back in if the send fails
		nrService.sendTracedErrors(errors);
		errors = [];
	};
	
	this.onTransactionFinished = function(transaction) {
		if (transaction.statusCode && transaction.statusCode >= 400) {
			if (!ignoreStatusCode(transaction.statusCode)) {
				noticeError(transaction);
			}
		}
	};
	
	this.onSendError = function(_errors) {
		var len = Math.min(_errors.length, MAX_ERRORS - errors.length);
		for (var i = 0; i < len; i++) {
			errors.push(_errors[i]);
		}
	};
}


exports.ErrorService = ErrorService;

