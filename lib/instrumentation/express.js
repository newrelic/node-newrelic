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
          var transaction = agent.getTransaction();
          if (!transaction) return original.apply(this, arguments);

          var segment = transaction.getTrace().add('View/' + view + '/Rendering');

          var args = Array.prototype.slice.call(arguments, 0);
          var cb = args[2];

          if (!cb) {
            args[2] = agent.tracer.callbackProxy(function () {
              segment.end();
            });
          }
          else {
            args[2] = agent.tracer.callbackProxy(function () {
              var returned = cb.apply(this, arguments);
              segment.end();

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
        var transaction = agent.getTransaction();
        if (!transaction) return original.apply(this, arguments);

        var segment = transaction.getTrace().add('View/' + view + '/Rendering');

        if ('function' === typeof options) {
          cb = options;
          options = {};
        }

        if (!cb) {
          cb = agent.tracer.callbackProxy(function () {
            segment.end();
          });
        }
        else {
          cb = agent.tracer.callbackProxy(function () {
            var returned = cb.apply(this, arguments);
            segment.end();

            return returned;
          });
        }

        return original.call(this, view, options, cb);
      };
    });
  }
};
