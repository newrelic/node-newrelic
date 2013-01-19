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
    if (handle.length === 3) {
      wrapped = function wrappedConnectHandle(req, res, next) {
        return agent.tracer.callbackProxy(handle).call(this, req, res, next);
      };
    }
    // don't break other error handlers
    else if (handle.length === 4) {
      wrapped = function wrappedConnectHandle(err, req, res, next) {
        return agent.tracer.callbackProxy(handle).call(this, err, req, res, next);
      };
    }
    else {
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
        if (error) {
          var transaction = agent.getTransaction();
          agent.errors.add(transaction, error);
        }

        return next(error);
      }
    };

    return function (route, handle) {
      var stack = this.stack;
      if (stack[stack.length - 1] === interceptor) stack.pop();

      var returned;
      if (typeof handle === 'function') {
        returned = use.call(this, route, wrapHandle(handle));
      }
      else if (typeof route === 'function') {
        returned = use.call(this, wrapHandle(route));
      }
      else if (handle instanceof http.Server) {
        returned = use.call(this, route, wrapListener(handle));
      }
      else if (route instanceof http.Server) {
        returned = use.call(this, wrapListener(route));
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
