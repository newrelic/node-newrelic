var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  ;

exports.initialize = function (agent, trace, net) {
  var listen = shimmer.preserveMethod(net.Server.prototype, 'listen');
  net.Server.prototype.listen = function () {
    listen.apply(this, arguments);

    // we can notice the port here
    if (arguments.length > 0 && !isNaN(parseInt(arguments[0], 10))) {
      agent.noticeAppPort(arguments[0]);
    }
  };
};
