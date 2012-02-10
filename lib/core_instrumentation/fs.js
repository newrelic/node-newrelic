
    
exports.initialize = function(agent, trace, fs) {
    var _readdir = fs.readdir;
    
    fs.readdir = function(path, callback) {
        var tx = agent.getTransaction();
        if (!tx) {
            return _readdir(path, callback);
        }

        var tracer = new trace.Tracer(tx, 'Filesystem/ReadDir/' + path);
        return _readdir(path, function() {
            tracer.finish();
             
            callback.apply(this, arguments);
        });
    };
};
    
