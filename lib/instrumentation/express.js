
// this is a modified version of the profiler in express
function profiler(agent, trace){
    return function(req, res, next){
        var transaction = agent.createTransaction();
        var tracer = new trace.Tracer(transaction);
        transaction.url = req.url;
        
        var end = res.end;

        // proxy res.end()
        res.end = function(data, encoding){
            res.end = end;
            res.end(data, encoding);
            
            transaction.statusCode = res.statusCode;
            // FIXME get the response status message
            tracer.finish();
        };

        next();
    };
};


exports.initialize = function(agent, trace, connect) {
    // FIXME update environment with framework info
    var _createServer = connect.createServer;
    connect.createServer = function(options) {
        agent.getEnvironment().setDispatcher('express');
        agent.getEnvironment().setFramework('express');
        var server = _createServer.apply(this, arguments);
        server.use(profiler(agent, trace));
        return server;
    };
};