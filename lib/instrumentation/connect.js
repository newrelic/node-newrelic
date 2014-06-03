'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , logger  = require(path.join(__dirname, '..', 'logger')).child({component : 'connect'})
  , wrapMiddlewareStack = require(path.join(__dirname, 'shared', 'connect-express')).wrapMiddlewareStack
  ;

module.exports = function initialize(agent, connect) {
  var interceptor = {
    route : '',
    handle : function sentinel(error, req, res, next) {
      if (error) {
        var transaction = agent.tracer.getTransaction();
        if (transaction) {
          transaction.exceptions.push(error);
        }
        else {
          agent.errors.add(null, error);
        }
      }

      return next(error);
    }
  };

  /**
   * Connect 1 and 2 are very different animals, but like Express, it mostly
   * comes down to factoring.
   */
  var version = connect && connect.version && connect.version[0];
  switch (version) {
    case '1':
      shimmer.wrapMethod(connect && connect.HTTPServer && connect.HTTPServer.prototype,
                         'connect.HTTPServer.prototype',
                         'use',
                         wrapMiddlewareStack.bind(null, false, interceptor,
                                                  null, agent.tracer));
      break;

    case '2':
      shimmer.wrapMethod(connect && connect.proto,
                         'connect.proto',
                         'use',
                         wrapMiddlewareStack.bind(null, false, interceptor,
                                                  null, agent.tracer));
      break;

    default:
      logger.debug("Unrecognized version %s of Connect detected; not instrumenting.",
                   version);
  }
};
