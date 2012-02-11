var metric = require('../metric');

exports.initialize = function(agent, trace, http) {
    var createServer = http.createServer;
    function createServerCustom(cb) {
        return createServer(function(req, resp) {
            agent.setTransaction(null);
            if (req.url !== "/favicon.ico") {
                var transaction = agent.createTransaction();
                var tracer = new trace.Tracer(transaction);
                transaction.url = req.url;

                var _end = resp.end;
                resp.end = function() {
                    _end.apply(this, arguments);

                    transaction.statusCode = resp.statusCode;
                    // FIXME get the response status message
                    tracer.finish();
                };
            }
            cb(req, resp);
        });
    }
    http.createServer = createServerCustom.bind(http);
    
    var _request = http.Client.prototype.request;
    http.Client.prototype.request = function() {        
        var req = _request.apply(this, arguments);
        var tx = agent.getTransaction();
        if (tx && !this.__NEWRELIC) {
            var tracer = new trace.Tracer(tx, metric.externalMetrics(this.host, 'http'));
            // this is the client
            this.on('error', tracer.finish);
            req.on('response', tracer.finish);
        }
        return req;
    };
};

