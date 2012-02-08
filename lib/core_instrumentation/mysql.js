exports.initialize = function(agent, trace) {
	var Client = require('mysql').Client;
	
	var _query = Client.prototype.query;
	Client.prototype.query = function(sql, callback) {

		var tx = agent.transaction;
		if (!tx) {
			return _query.apply(this, arguments);
		}
		var tracer = new trace.Tracer(tx, 'Database/test');
		var wrapper = function() {
			tracer.finish();
			callback.apply(this, arguments);
		}
		return _query.apply(this, [sql, wrapper]);
		
	}
}