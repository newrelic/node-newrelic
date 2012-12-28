'use strict';

var http    = require('http')
  , path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , logger  = require(path.join(__dirname, '..', 'logger')).child({component : 'express'})
  ;

module.exports = function initialize(agent, express) {
  function setDispatcher(original) {
    return function wrappedCreateServer() {
      agent.environment.setDispatcher('express');
      agent.environment.setFramework('express');

      return original.apply(this, arguments);
    };
  }

  function wrapRender(version, original) {
    return function (view, options, cb, parent, sub) {
      logger.trace("Potentially tracing rendering of an Express %d view.",
                   version);
      var state = agent.getState();
      if (!state) {
        logger.trace("Express %d view rendered outside of a transaction, not measuring.",
                     version);
        return original.apply(this, arguments);
      }

      var name        = 'View/' + view + '/Rendering'
        , transaction = state.getTransaction()
        , current     = state.getSegment()
        ;

      var finishRender = function finishRender() {
        var segment = state.getSegment();
        if (transaction.scope) {
          transaction.measure(name,
                              transaction.scope,
                              segment.getDurationInMillis());
        }
        transaction.measure(name, null, segment.getDurationInMillis());
        logger.trace("Express %d view render trace segment ended for transaction %d.",
                     version,
                     transaction.id);
      };

      var segment = current.add(name, finishRender);

      if ('function' === typeof options) {
        cb = options;
        options = null;
      }

      var wrapped;
      if (!cb) {
        /* CAUTION: The callback is necessary to generate a metric, but
         * inserting a callback can change user app semantics.
         */
        wrapped = function (err, rendered) {
          segment.end();
          if (err) return this.req.next(err);

          return this.send(rendered);
        }.bind(this);
      }
      else {
        wrapped = agent.tracer.callbackProxy(function renderCallback() {
          var returned = agent.errors.monitor(transaction, function () {
            return cb.apply(this, arguments);
          }.bind(this));
          segment.end();
          return returned;
        });
      }

      return agent.errors.monitor(transaction, function () {
        return original.call(this, view, options, wrapped, parent, sub);
      }.bind(this));
    };
  }

  switch (express.version[0]) {
    case '2':
      shimmer.wrapMethod(express,
                         'express',
                         'createServer',
                         setDispatcher);

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
                   express.version[0]);
  }
};
