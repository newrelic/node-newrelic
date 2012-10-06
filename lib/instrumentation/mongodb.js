"use strict";

var path            = require('path')
  , util            = require('util')
  , ParsedStatement = require(path.join(__dirname, '..', 'db', 'parsed-statement'))
  , shimmer         = require(path.join(__dirname, '..', 'shimmer'))
  ;

module.exports = function initialize(agent, mongodb) {
  function addFunctionProxy(operation) {
    shimmer.wrapMethod(mongodb.Collection.prototype, 'mongodb.Collection.prototype', operation, function (original) {
      return agent.tracer.segmentProxy(function () {
        var state = agent.getState();
        // bail out -- something's hosed
        if (!state || arguments.length < 1) return original.apply(this, arguments);

        var current = state.getSegment();

        // Since the shim is wrapping a prototypal method, collectionName should
        // always be set, but better safe than sorry.
        var collection = this.collectionName || 'unknown';

        var statement = new ParsedStatement(operation, collection);
        var statementSegment = current.add('MongoDB/' + collection + '/' + operation,
                                           statement.recordMetrics.bind(statement));

        // For query methods, the first value is almost always going
        // to be the query terms, so add them to the segment.
        if (arguments[0] && typeof(arguments[0]) !== 'function') {
          statementSegment.parameters = arguments[0];
        }
        state.setSegment(statementSegment);

        var callback = arguments[arguments.length - 1];
        if (typeof(callback) !== 'function') {
          var cursor = original.apply(this, arguments);
          // FIXME: we have a (non-observable) cursor here -- we need to defer
          // closing the segment until whatever code is using the cursor is
          // done with it
          statementSegment.end();
          return cursor;
        }
        else {
          var args = Array.prototype.slice.call(arguments);

          args[args.length - 1] = agent.tracer.callbackProxy(function () {
            var returned = callback.apply(this, arguments);
            statementSegment.end();
            return returned;
          });

          // call the original function.
          return original.apply(this, args);
        }
      });
    });
  }

  // Proxy the CRUD functions.
  [
    'insert',
    'find',
    'update',
    'remove',
    'save'
  ].forEach(function (operation) {
    addFunctionProxy(operation);
  });
};
