'use strict';

var path    = require('path')
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
  var interceptor = {
    route : '',
    handle : function sentinel(error, req, res, next) {
      if (error) {
        var transaction = agent.getTransaction();
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

  function wrapHandle(handle) {
    var wrapped;

    // reiterated: testing function arity is stupid
    switch (handle.length) {
      case 2:
        wrapped = function wrappedConnectHandle(req, res) {
          void res; // shut up, jshint
          return agent.tracer.callbackProxy(handle).apply(this, arguments);
        };
        break;

      case 3:
        wrapped = function wrappedConnectHandle(req, res, next) {
          void next; // shut up, jshint
          return agent.tracer.callbackProxy(handle).apply(this, arguments);
        };
        break;

      // don't break other error handlers
      case 4:
        wrapped = function wrappedConnectHandle(err, req, res, next) {
          void next; // shut up, jshint
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

  function wrapUse(use) {
    return function () {
      if (!this.stack) return use.apply(this, arguments);

      this.stack = this.stack.filter(function (m) { return m !== interceptor; });

      var app = use.apply(this, arguments);

      // wrap most recently added unwrapped handler
      var top = this.stack.pop();
      if (top) {
          if (top.handle &&
              typeof top.handle === 'function' &&
              !top.handle[ORIGINAL]) {
            top.handle = wrapHandle(top.handle);
          }
          this.stack.push(top);
      }

      /* Give the error tracer a better chance of intercepting errors by
       * putting it before the first error handler (a middleware that takes 4
       * parameters, in Connect's world). Error handlers tend to be placed
       * towards the end of the middleware chain and sometimes don't pass
       * errors along. Don't just put the interceptor at the beginning because
       * we want to allow as many middleware functions to execute as possible
       * before the interceptor is run, to increase error coverage.
       *
       * NOTE: This is heuristic, and works because interceptor propagates
       *       errors instead of terminating the middleware chain.
       *       Ignores routes.
       */
      var spliced = false;
      for (var i = 0; i < this.stack.length; i++) {
        var middleware = this.stack[i];
        if (middleware &&
            middleware.handle &&
            middleware.handle.length === 4) {
          this.stack.splice(i, 0, interceptor);
          spliced = true;
          break;
        }
      }
      if (!spliced) this.stack.push(interceptor);

      // don't break chaining
      return app;
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
