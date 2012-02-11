var error = require('../lib/error');
var config = require('../lib/config.default');
var logger = require('../lib/logger').getLogger();

function createTransaction(code) {
	return new function() {
		this.statusCode = code;
	}
}

exports.testOnSendError = function(beforeExit, assert) {
	var service = new error.ErrorService(logger, config['config']);
	
	var errors = [1,2,3,4,5];
	service.onSendError(errors);
	
	assert.equal(5, service.getErrors().length);
	
	service.onSendError(errors);
	assert.equal(10, service.getErrors().length);
	
	service.onSendError(errors);
	service.onSendError(errors);
	service.onSendError([3,4,5,6,6,6,6,6]); // we're over the max here. 
	assert.equal(20, service.getErrors().length);
};


exports.testOnTransactionFinished  = function(beforeExit, assert) {
	var service = new error.ErrorService(logger, config['config']);
	
	service.onTransactionFinished(createTransaction(400));
	// this is ignored by default
	service.onTransactionFinished(createTransaction(404));
	service.onTransactionFinished(createTransaction(500));
	
	assert.equal(2, service.getErrorCount());
	assert.equal(2, service.getErrors().length);
};