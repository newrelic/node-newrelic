'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

module.exports = function initialize(agent, net) {
  shimmer.wrapMethod(net.Server.prototype, 'net.Server.prototype', 'listen', function (original) {
    return function () {
      // we can notice the port here
      if (arguments.length > 0 && !isNaN(parseInt(arguments[0], 10))) {
        agent.noticeAppPort(arguments[0]);
      }

      return original.apply(this, arguments);
    };
  });
};
