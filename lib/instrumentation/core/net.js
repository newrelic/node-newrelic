'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', '..', 'shimmer'))
  ;

module.exports = function initialize(agent, net) {
  shimmer.wrapMethod(net && net.Server && net.Server.prototype,
                     'net.Server.prototype',
                     'listen',
                     function (listen) {
    return function () {
      // notice the port here
      if (arguments.length > 0 && +arguments[0] > 0) {
        agent.noticeAppPort(arguments[0]);
      }

      return listen.apply(this, arguments);
    };
  });
};
