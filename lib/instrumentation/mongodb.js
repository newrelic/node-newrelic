"use strict";

var path            = require('path')
  , ParsedStatement = require(path.join(__dirname, '..', 'db', 'parsed-statement'))
  , shimmer         = require(path.join(__dirname, '..', 'shimmer'))
  , logger          = require(path.join(__dirname, '..', 'logger')).child({component : 'mongodb'})
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
  return function wrappedEach(operation) {
    // each throws without a callback parameter.
    return agent.tracer.callbackProxy(function proxiedEachHandler(callback) {
      var wrapped = agent.tracer.callbackProxy(function wrappedEachCallback() {
        if (!arguments[1]) {
          // The cursor is done when its callback is called with a
          // null value, one way or the other
          segment.end();
          logger.trace("MongoDB query trace segment ended.");
        }
        return callback.apply(this, arguments);
      });
      return operation.call(this, wrapped);
    });
  };
}

module.exports = function initialize(agent, mongodb) {
  function addFunctionProxy(operation) {
    shimmer.wrapMethod(mongodb && mongodb.Collection && mongodb.Collection.prototype,
                       'mongodb.Collection.prototype',
                       operation,
                       function (command) {
      return agent.tracer.segmentProxy(function () {
        logger.trace("Potentially tracing MongoDB query.");
        var state = agent.getState();
        // bail out -- something's hosed
        if (!state || arguments.length < 1) return command.apply(this, arguments);

        // Since the shim is wrapping a collection method, collectionName should
        // always be set, but better safe than sorry.
        var collection       = this.collectionName || 'unknown'
          , current          = state.getSegment()
          , statement        = new ParsedStatement(operation, collection)
          , statementSegment = current.add('MongoDB/' + collection + '/' + operation,
                                           statement.recordMetrics.bind(statement))
          ;

        logger.trace("Adding MongoDB query trace segment transaction %d.",
                     state.getTransaction().id);

        // For query methods, the first value is almost always going to be the
        // query terms, so add them to the segment.
        var terms = arguments[0];
        if (terms && typeof terms !== 'function') statementSegment.parameters = terms;
        state.setSegment(statementSegment);

        var callback = arguments[arguments.length - 1];
        if (typeof callback !== 'function') {
          // grab the cursor returned by the finder
          var cursor = command.apply(this, arguments);
          shimmer.wrapMethod(cursor, 'cursor', 'each', wrapEach(statementSegment, agent));
          return cursor;
        }
        else {
          var args = Array.prototype.slice.call(arguments);

          args[args.length - 1] = agent.tracer.callbackProxy(function () {
            var returned = callback.apply(this, arguments);
            statementSegment.end();
            logger.trace("MongoDB query trace segment ended for transaction %d.",
                         state.getTransaction().id);
            return returned;
          });

          return command.apply(this, args);
        }
      });
    });
  }

  // Proxy the CRUD functions.
  [
    'insert',
    'find',
    'update',
    'remove'
  ].forEach(function (operation) { addFunctionProxy(operation); });
};
