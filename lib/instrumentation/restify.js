'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , logger  = require(path.join(__dirname, '..', 'logger.js'))
                .child({component : 'restify'})
  , NAMES   = require(path.join(__dirname, '..', 'metrics', 'names.js'))
  ;

function nameFromRoute(segment, route, context) {
  if (!segment) return logger.error("No New Relic context to set Restify route name on.");
  if (!route) return logger.error("No Restify route to use for naming.");

  var params = context || route.params;
  if (params) {
    Object.keys(params).forEach(function (key) {
      segment.parameters[key] = params[key];
    });
  }

  var transaction = segment.trace.transaction
    , path        = (route.spec && (route.spec.path || route.spec.name)) || route.name
    ;

  if (!path) return logger.warn({route : route}, "No path found on Restify route.");

  // when route is a regexp, route.spec.path will be a regexp
  if (path instanceof RegExp) path = path.source;

  transaction.partialName = NAMES.RESTIFY.PREFIX + transaction.verb +
                            NAMES.ACTION_DELIMITER + path;
}

module.exports = function initialize(agent, restify) {
  /* Restify doesn't directly expose its Router constructor, so create a Server
   * and grab the constructor off it. Do it before instrumenting createServer
   * so the agent doesn't automatically set the dispatcher to Restify.
   */
  var oneoff = restify.createServer()
    , Router = oneoff.router.constructor
    , tracer = agent.tracer
    ;

  // hook the createServer method to record the framework
  shimmer.wrapMethod(restify, 'restify', 'createServer', function (createServer) {
    return function wrappedCreateServer() {
      agent.environment.setDispatcher('restify');
      agent.environment.setFramework('restify');

      return createServer.apply(this, arguments);
    };
  });

  shimmer.wrapMethod(Router.prototype, 'Router.prototype', 'find', function (find) {
    return function wrappedFind(req, res, callback) {
      var state = tracer.getState();
      if (!state) {
        logger.trace("Restify router invoked outside transaction.");
        return find.apply(this, arguments);
      }

      var wrapped = function (error, route, context) {
        nameFromRoute(state.getSegment(), route, context);
        return callback(error, route, context);
      };

      return find.call(this, req, res, wrapped);
    };
  });
};
