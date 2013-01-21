'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , logger  = require(path.join(__dirname, '..', 'logger')).child({component : 'express'})
  ;

module.exports = function initialize(agent, express) {
  /**
   * This happens at server creation time, and as such is outside
   * transactional scope.
   *
   * TODO: add transaction-free error interception
   */
  function setDispatcher(app) {
    return function wrappedCreateServer() {
      agent.environment.setDispatcher('express');
      agent.environment.setFramework('express');

      return app.apply(this, arguments);
    };
  }

  function finishRender(name, state) {
    var segment     = state.getSegment()
      , transaction = state.getTransaction()
      ;

    if (transaction.scope) {
      transaction.measure(name,
                          transaction.scope,
                          segment.getDurationInMillis());
    }
    transaction.measure(name, null, segment.getDurationInMillis());

    logger.trace("Rendered Express %d view with metric %s for transaction %d.",
                 version,
                 name,
                 transaction.id);
  }

  /**
   * This needs to be kept up to date with Express to ensure that it's using
   * the same logic to decide where the callback is hiding.
   */
  function wrapRender(version, render) {
    /*jshint maxparams:5*/ // follow Express as closely as possible
    return function (view, options, cb, parent, sub) {
      logger.trace("Rendering Express %d view %s.", version, view);
      var state = agent.getState();
      if (!state) {
        logger.trace("Express %d view %s rendered outside transaction, not measuring.",
                     version,
                     view);
        return render.apply(this, arguments);
      }

      var name    = 'View/' + view + '/Rendering'
        , current = state.getSegment()
        , segment = current.add(name, finishRender.bind(null, name, state))
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
        wrapped = function syntheticCallback(err, rendered) {
          if (err) {
            segment.end();
            return this.req.next(err);
          }

          var returned = this.send(rendered);
          segment.end();

          return returned;
        }.bind(this);
      }
      else {
        wrapped = agent.tracer.callbackProxy(function renderWrapper() {
          var returned = cb.apply(this, arguments);
          segment.end();

          return returned;
        });
      }

      return agent.errors.monitor(
        render.bind(this, view, options, wrapped, parent, sub),
        state.getTransaction()
      );
    };
  }

  /**
   * Express 2 and 3 have very different factoring, even though the core
   * instrumentation is the same.
   */
  var version = express && express.version && express.version[0];
  switch (version) {
    case '2':
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
      break;

    default:
      logger.error("Unrecognized version %d of Express detected; not instrumenting",
                   version);
  }
};
