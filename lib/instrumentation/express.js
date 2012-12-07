'use strict';

var http    = require('http')
  , path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , logger  = require(path.join(__dirname, '..', 'logger')).child({component : 'express'})
  ;

module.exports = function initialize(agent, express) {
  if (express.version[0] === '2') {
    shimmer.wrapMethod(express, 'express', 'createServer', function (original) {
      return function wrappedCreateServer() {
        agent.environment.setDispatcher('express');
        agent.environment.setFramework('express');

        return original.apply(this, arguments);
      };
    });

    shimmer.wrapMethod(http.ServerResponse.prototype,
                       'http.ServerResponse.prototype',
                       'render',
                       function (original) {
        return function (view) {
          logger.trace("Potentially tracing rendering of an Express 2 view.");
          var state = agent.getState();
          if (!state) return original.apply(this, arguments);

          var current = state.getSegment();
          var segment = current.add('View/' + view + '/Rendering');

          var args = Array.prototype.slice.call(arguments, 0);
          var cb = args[2];

          if (!cb) {
            args[2] = agent.tracer.callbackProxy(function () {
              segment.end();
              logger.trace("Express 2 view render trace segment ended for transaction %d",
                           state.getTransaction().id);
            });
          }
          else {
            args[2] = agent.tracer.callbackProxy(function () {
              var returned = cb.apply(this, arguments);

              segment.end();
              logger.trace("Express 2 view render trace segment ended for transaction %d",
                           state.getTransaction().id);

              return returned;
            });
          }

          return original.apply(this, args);
        };
      }
    );
  }

  if (express.version[0] === '3') {
    shimmer.wrapMethod(express.application,
                       'express.application',
                       'init',
                       function (original) {
      return function wrappedAppInit() {
        agent.environment.setDispatcher('express');
        agent.environment.setFramework('express');

        return original.apply(this, arguments);
      };
    });

    shimmer.wrapMethod(express.response,
                       'express.response',
                       'render',
                       function (original) {
      return function (view, options, cb) {
        logger.trace("Potentially tracing rendering of an Express 3 view.");
        var state = agent.getState();
        if (!state) return original.apply(this, arguments);

        var current = state.getSegment();

        var name = 'View/' + view + '/Rendering';
        var segment = current.add(name, function () {
          var transaction = segment.trace.transaction;
          if (transaction.scope) transaction.measure(name, transaction.scope, segment.getDurationInMillis());
          transaction.measure(name, null, segment.getDurationInMillis());
          logger.trace("Express 3 view render trace segment ended for transaction %d",
                       transaction.id);
        });

        if ('function' === typeof options) {
          cb = options;
          options = {};
        }

        var wrapped;
        if (!cb) {
          wrapped = function (err, rendered) {
            segment.end();
            if (err) return this.req.next(err);
            this.send(rendered);
          }.bind(this);
        }
        else {
          wrapped = agent.tracer.callbackProxy(function () {
            var returned = cb.apply(this, arguments);
            segment.end();
            return returned;
          });
        }

        return original.call(this, view, options, wrapped);
      };
    });
  }
};
