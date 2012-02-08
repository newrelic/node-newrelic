

exports.initialize = function(agent, trace) {
    var http = require('http');
    var createServer = http.createServer;
    function createServerCustom(cb) {
        return createServer(function(req, resp) {
            if (req.url !== "/favicon.ico") {
                var transaction = agent.createTransaction();
                var tracer = new trace.Tracer(transaction);
                transaction.url = req.url;

                var end = resp.end.bind(resp);
                resp.end = function(data, encoding) {
                    end(data, encoding);

                    transaction.statusCode =  resp.statusCode;
                    tracer.finish();
                };
            }
            cb(req, resp);
        });
    }
    http.createServer = createServerCustom.bind(http);
};

