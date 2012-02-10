exports.initialize = function(agent, trace, net) {    
    var _listen = net.Server.prototype.listen;    
    net.Server.prototype.listen = function() {
        _listen.apply(this, arguments);
        // we can notice the port here
        if (arguments.length > 0 && !isNaN(Number(arguments[0]))) 
        {
            agent.noticeAppPort(arguments[0]);
        }
    };
};
