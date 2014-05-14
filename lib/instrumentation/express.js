'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer.js'))
  , urltils = require(path.join(__dirname, '..', 'util', 'urltils.js'))
  , logger  = require(path.join(__dirname, '..', 'logger.js'))
                .child({component : 'express'})
  , record  = require(path.join(__dirname, '..', 'metrics', 'recorders', 'generic.js'))
  , NAMES   = require(path.join(__dirname, '..', 'metrics', 'names.js'))
  , VIEW    = NAMES.VIEW
  ;

var ORIGINAL = '__NR_original';
var RESERVED = [ // http://es5.github.io/#x7.6.1.2
  // always (how would these even get here?)
  'class', 'enum', 'extends', 'super', 'const', 'export', 'import',
  // strict
  'implements', 'let', 'private', 'public', 'yield', 'interface',
  'package', 'protected', 'static'
];

/**
 * ES5 strict mode disallows some identifiers that are allowed in non-strict
 * code. Mangle function names that are on that list of keywords so they're
 * non-objectionable in strict mode (which is currently enabled everywhere
 * inside the agent, as well as at many customer sites).
 *
 * If you really need to crawl your Express app's middleware stack, change
 * your test to use name.indexOf('whatever') === 0 as the predicate instead
 * of name === 'whatever'. It's a little slower, but you shouldn't be doing
 * that anyway.
 *
 * @param {string} name The candidate function name
 *
 * @returns {string} A safe (potentially mangled) function name.
 */
function mangle(name) {
  if (RESERVED.indexOf(name) !== -1) return name + '_';

  return name;
}

function nameFromRoute(segment, route) {
  if (!segment) return logger.error("No New Relic context to set Express route name on.");
  if (!route) return logger.debug("No Express route to use for naming.");

  var transaction = segment.trace.transaction
    , path        = route.path || route.regexp
    ;

  if (!path) return logger.debug({route : route}, "No path found on Express route.");

  // when route is a regexp, route.path will be a regexp
  if (path instanceof RegExp) path = path.source;

  urltils.copyParameters(transaction.agent.config, route.params, segment.parameters);

  transaction.partialName = NAMES.EXPRESS.PREFIX + transaction.verb +
                            NAMES.ACTION_DELIMITER + path;
}

module.exports = function initialize(agent, express) {
  var tracer = agent.tracer;

  var interceptor;
  // This is the error handler we inject for express4. Yanked from connect support.
  function sentinel(error, req, res, next) {
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

  function setDispatcher(app) {
    return function wrappedCreateServer() {
      agent.environment.setDispatcher('express');
      agent.environment.setFramework('express');

      return app.apply(this, arguments);
    };
  }

  /**
   * This needs to be kept up to date with Express to ensure that it's using
   * the same logic to decide where the callback is hiding.
   */
  function wrapRender(version, render) {
    /*jshint maxparams:5*/ // follow Express as closely as possible
    return function cls_wrapRender(view, options, cb, parent, sub) {
      logger.trace("Rendering Express %d view %s.", version, view);
      if (!tracer.getTransaction()) {
        logger.trace("Express %d view %s rendered outside transaction, not measuring.",
                     version,
                     view);
        return render.apply(this, arguments);
      }

      var name    = VIEW.PREFIX + view + VIEW.RENDER
        , segment = tracer.addSegment(name, record)
        , wrapped
        ;

      if ('function' === typeof options) {
        cb = options;
        options = null;
      }

      if (cb === null || cb === undefined) {
        /* CAUTION: Need this to generate a metric, but adding a callback
         * changes Express's control flow.
         */
        wrapped = tracer.callbackProxy(function syntheticCallback(err, rendered) {
          if (err) {
            segment.end();
            logger.trace(err,
                         "Express %d rendering for metric %s failed for transaction %d:",
                         version,
                         name,
                         segment.trace.transaction.id);

            return this.req.next(err);
          }

          var returned = this.send(rendered);
          segment.end();

          logger.trace("Rendered Express %d view with metric %s for transaction %d.",
                       version,
                       name,
                       segment.trace.transaction.id);

          return returned;
        }.bind(this));
      }
      else {
        wrapped = tracer.callbackProxy(function renderWrapper() {
          var returned = cb.apply(this, arguments);
          segment.end();

          return returned;
        });
      }

      return render.call(this, view, options, wrapped, parent, sub);
    };
  }

  function wrapMatchRequest(version, matchRequest) {
    return function cls_wrapMatchRequest() {
      if (!tracer.getTransaction()) {
        logger.trace("Express %d router called outside transaction.", version);
        return matchRequest.apply(this, arguments);
      }
      var route = matchRequest.apply(this, arguments);
      nameFromRoute(tracer.getSegment(), route);
      return route;
    };
  }

  function wrapProcessParams(version, process_params) {
    return function cls_wrapProcessParams() {
      if (!tracer.getTransaction()) {
        logger.trace("Express %d router called outside transaction.", version);
        return process_params.apply(this, arguments);
      }
      if (arguments.length) {
        if (arguments[0].route) {
          nameFromRoute(tracer.getSegment(), arguments[0].route);
        }
      }
      return process_params.apply(this, arguments);
    };
  }

  /**
   * Problem:
   *
   * 1. Express determines whether middleware functions are error handlers by
   *    testing their arity. Not cool.
   * 2. Downstream Express users rely upon being able to iterate over their
   *    middleware stack to find specific middleware functions. Sorta less
   *    uncool, but still a pain.
   *
   * Solution:
   *
   * Use eval. This once. For this one specific purpose. Not anywhere else for
   * any reason.
   */
  function wrapHandle(handle) {
    var arglist
      , name = ''
      ;

    // reiterated: testing function arity is stupid
    switch (handle.length) {
      case 2:
        arglist = '(req, res)';
        break;

      case 3:
        arglist = '(req, res, next)';
        break;

      // don't break other error handlers
      case 4:
        arglist = '(err, req, res, next)';
        break;

      default:
        arglist = '()';
    }

    if (handle.name) name = mangle(handle.name);

    var template = function () {
      var args = tracer.slice(arguments)
        , last = args.length - 1
        ;

      if (typeof args[last] === 'function') {
        args[last] = tracer.callbackProxy(args[last]);
      }

      handle.apply(this, args);
    };

    // I am a bad person and this makes me feel bad.
    // We use eval because we need to insert the function with a specific name to allow for lookups.
    // jshint evil:true
    var wrapped = eval(
      '(function(){return function ' + name + arglist +
      template.toString().substring(11) + '}())'
    );
    wrapped[ORIGINAL] = handle;
    // jshint evil:false

    return wrapped;
  }

  function wrapMiddlewareStack(route, use) {
    return function cls_wrapMiddlewareStack() {
      if (this.stack && this.stack.length) {
        // Remove our custom error handler.
        this.stack = this.stack.filter(function cb_filter(m) { return m !== interceptor; });
      }
      if (!interceptor) {
        // call use to create a Layer object, then pop it off and store it.
        use.call(this, '/', sentinel);
        interceptor = this.stack.pop();
      }

      /* We allow `use` to go through the arguments so it can reject bad things
       * for us so we don't have to also do argument type checking.
       */
      var app = use.apply(this, arguments);

      /* Express adds routes to the same stack as middlewares. We need to wrap
       * that adder too but we only want to wrap the middlewares that are
       * added, not the Router.
       */
      if (!route) {
        // wrap most recently added unwrapped handler
        var top = this.stack[this.stack.length-1];
        if (top) {
            if (top.handle &&
                typeof top.handle === 'function' &&
                !top.handle[ORIGINAL]) {
              top.handle = wrapHandle(top.handle);
            }
        }
      }

      /* Give the error tracer a better chance of intercepting errors by
       * putting it before the first error handler (a middleware that takes 4
       * parameters, in express's world). Error handlers tend to be placed
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
        // Check to see if it is an error handler middleware
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
   * Major versions of express have very different factoring,
   * even though the core instrumentation is the same.
   */
  var version = express && express.version && express.version[0];

  /* TJ decided he didn't want to deal with the hassle of updating a
   * version field. Thanks, TJ!
   */
  if (!version && express && express.application &&
      express.application.init && express.response &&
      express.response.render && express.Router &&
      express.Router.prototype.matchRequest) {
    version = '3';
  } else {

    // FLAG: express4 support
    if (agent.config.feature_flag.express4) {

      if (!version && express && express.application &&
             express.application.init && express.response &&
             express.response.render && express.Router &&
             express.Router.process_params) {
        logger.trace('Express 4 detected, express4 feature flag is enabled, instrumenting.');
        version = '4';
      }
    } else {
      // TODO: add warning or go silent
      logger.trace('express4 feature flag is disabled, not attempting to detect.');
    }

  }

  switch (version) {
    case '2':
      /* Express 2 doesn't directly expose its Router constructor, so create an
       * app and grab the constructor off it. Do it before instrumenting
       * createServer so the agent doesn't automatically set the dispatcher
       * to Express.
       */
      var oneoff = express.createServer()
        , Router = oneoff.routes.constructor
        ;

      shimmer.wrapMethod(express,
                         'express',
                         'createServer',
                         setDispatcher);

      /* Express 2 squirts its functionality directly onto http.ServerResponse,
       * leaving no clean way to wrap its functionality without pulling in the
       * http module ourselves.
       */
      var http = require('http');
      shimmer.wrapMethod(http.ServerResponse.prototype,
                         'http.ServerResponse.prototype',
                         'render',
                         wrapRender.bind(null, 2));

      shimmer.wrapMethod(Router.prototype,
                         'Router.prototype',
                         '_match',
                         wrapMatchRequest.bind(null, 2));
      break;

    case '3':
      shimmer.wrapMethod(express.application,
                         'express.application',
                         'init',
                         setDispatcher);

      shimmer.wrapMethod(express.response,
                         'express.response',
                         'render',
                         wrapRender.bind(null, 3));

      shimmer.wrapMethod(express.Router.prototype,
                         'express.Router.prototype',
                         'matchRequest',
                         wrapMatchRequest.bind(null, 3));
      break;

    case '4':
      shimmer.wrapMethod(express.application,
                         'express.application',
                         'init',
                         setDispatcher);

      shimmer.wrapMethod(express.response,
                         'express.response',
                         'render',
                         wrapRender.bind(null, 4));

      shimmer.wrapMethod(express.Router,
                         'express.Router',
                         'process_params',
                         wrapProcessParams.bind(null, 4));

      shimmer.wrapMethod(express.Router,
                         'express.Router',
                         'use',
                         wrapMiddlewareStack.bind(null, false));

      shimmer.wrapMethod(express.Router,
                         'express.Router',
                         'route',
                         wrapMiddlewareStack.bind(null, true));
      break;
    default:
      logger.warn("Unrecognized version %d of Express detected; not instrumenting",
                  version);
  }
};
