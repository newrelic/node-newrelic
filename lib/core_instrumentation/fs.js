var fs = require('fs');
	
exports.initialize = function(agent, trace) {
	var _readdir = fs.readdir;
	
	fs.readdir = function(path, callback) {
		var tx = agent.transaction;
		if (!tx) {
			return _readdir(path, callback);
		}

		var tracer = new trace.Tracer(tx, 'Filesystem/ReadDir/' + path);
		return _readdir(path, function(err, files) {
			tracer.finish();
			 
			callback(err, files);
		});
	}
}
	
