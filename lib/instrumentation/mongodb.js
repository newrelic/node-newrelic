"use strict";

var path            = require('path')
  , ParsedStatement = require(path.join(__dirname, '..', 'db', 'parsed-statement'))
  , shimmer         = require(path.join(__dirname, '..', 'shimmer'))
  ;

/**
 * Wrap each, because in most read queries it's the end point of the database
 * call chain.
 *
 * @param {TraceSegment} segment The current segment, to be closed when done.
 * @param {Agent} agent The currently active agent.
 *
 * @returns {Function} A callback that further wraps the callback called by the
 *                     wrapped each method, so we can tell when the cursor is
 *                     exhausted.
 */
function wrapEach(segment, agent) {
  return function (original) {
    return agent.tracer.callbackProxy(function () {
      // each throws without a callback parameter.
      var callback = arguments[0];

      var wrapped;
      if (callback) {
        wrapped = agent.tracer.callbackProxy(function () {
          if (!arguments[1]) {
            // The cursor is done when its callback is called with a
            // null value, one way or the other
            segment.end();
          }
          return callback.apply(this, arguments);
        });
      }
      return original.call(this, wrapped);
    });
  };
}

module.exports = function initialize(agent, mongodb) {
  function addFunctionProxy(operation) {
    shimmer.wrapMethod(mongodb.Collection.prototype, 'mongodb.Collection.prototype', operation, function (original) {
      return agent.tracer.segmentProxy(function () {
        var state = agent.getState();
        // bail out -- something's hosed
        if (!state || arguments.length < 1) return original.apply(this, arguments);

        var current = state.getSegment();

        // Since the shim is wrapping a collection method, collectionName should
        // always be set, but better safe than sorry.
        var collection = this.collectionName || 'unknown';

        var statement = new ParsedStatement(operation, collection);
        var statementSegment = current.add('MongoDB/' + collection + '/' + operation,
                                           statement.recordMetrics.bind(statement));

        // For query methods, the first value is almost always going to be the
        // query terms, so add them to the segment.
        if (arguments[0] && typeof(arguments[0]) !== 'function') {
          statementSegment.parameters = arguments[0];
        }
        state.setSegment(statementSegment);

        var callback = arguments[arguments.length - 1];
        if (typeof(callback) !== 'function') {
          // grab the cursor returned by the finder
          var cursor = original.apply(this, arguments);
          shimmer.wrapMethod(cursor, 'cursor', 'each', wrapEach(statementSegment, agent));
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
