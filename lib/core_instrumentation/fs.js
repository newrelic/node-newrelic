
    
exports.initialize = function(agent, trace) {
    var fs = require('fs');
    var _readdir = fs.readdir;
    
    fs.readdir = function(path, callback) {
        var tx = agent.transaction;
        if (!tx) {
            return _readdir(path, callback);
        }

        var tracer = new trace.Tracer(tx, 'Filesystem/ReadDir/' + path);
        return _readdir(path, function() {
            tracer.finish();
             
            callback.apply(this, arguments);
        });
    }
}
    
