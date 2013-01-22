'use strict';

var path    = require('path')
  , http    = require('http')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , logger  = require(path.join(__dirname, '..', 'logger')).child({component : 'connect'})
  ;

/*
 *
 * CONSTANTS
 *
 */

var ORIGINAL = '__NR_original';

module.exports = function initialize(agent, connect) {
  function wrapHandle(handle) {
    var wrapped;

    // reiterated: testing function arity is stupid
    switch (handle.length) {
      case 2:
        wrapped = function wrappedConnectHandle(req, res) {
          return agent.tracer.callbackProxy(handle).apply(this, arguments);
        };
        break;

      case 3:
        wrapped = function wrappedConnectHandle(req, res, next) {
          return agent.tracer.callbackProxy(handle).apply(this, arguments);
        };
        break;

      // don't break other error handlers
      case 4:
        wrapped = function wrappedConnectHandle(err, req, res, next) {
          return agent.tracer.callbackProxy(handle).apply(this, arguments);
        };
        break;

      default:
        wrapped = function wrappedConnectHandle() {
          return agent.tracer.callbackProxy(handle).apply(this, arguments);
        };
    }
    wrapped[ORIGINAL] = handle;

    return wrapped;
  }

  function wrapListener(server) {
    var listener = server.listeners('request')[0];
    if (!listener) return server;

    return wrapHandle(listener);
  }

  function wrapUse(use) {
    var interceptor = {
      route : '',
      handle : function sentinel(error, req, res, next) {
        if (error) agent.errors.add(agent.getTransaction(), error);

        return next(error);
      }
    };

    return function (route, handle) {
      var stack = this.stack;
      if (stack[stack.length - 1] === interceptor) stack.pop();

      var returned;
      if (handle instanceof http.Server) {
        returned = use.call(this, route, wrapListener(handle));
      }
      else if (route instanceof http.Server) {
        returned = use.call(this, wrapListener(route));
      }
      else if (typeof handle === 'function') {
        returned = use.call(this, route, wrapHandle(handle));
      }
      else if (typeof route === 'function') {
        returned = use.call(this, wrapHandle(route));
      }
      else {
        returned = use.call(this, route, handle);
      }

      stack.push(interceptor);
      return returned;
    };
  }

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
                         wrapUse);
      break;

    case '2':
      shimmer.wrapMethod(connect && connect.proto,
                         'connect.proto',
                         'use',
                         wrapUse);
      break;

    default:
      logger.error("Unrecognized version %s of Connect detected; not instrumenting.",
                   version);
  }
};
