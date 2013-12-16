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
    return function (view, options, cb, parent, sub) {
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
    return function () {
      if (!tracer.getTransaction()) {
        logger.trace("Express %d router called outside transaction.", version);
        return matchRequest.apply(this, arguments);
      }

      var route = matchRequest.apply(this, arguments);
      nameFromRoute(tracer.getSegment(), route);
      return route;
    };
  }

  /**
   * Express 2 and 3 have very different factoring, even though the core
   * instrumentation is the same.
   */
  var version = express && express.version && express.version[0];

  /* TJ decided he didn't want to deal with the hassle of updating a
   * version field. Thanks, TJ!
   */
  if (!version && express &&
      express.application && express.application.init &&
      express.response && express.response.render) {
    version = '3';
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

    default:
      logger.warn("Unrecognized version %d of Express detected; not instrumenting",
                  version);
  }
};
