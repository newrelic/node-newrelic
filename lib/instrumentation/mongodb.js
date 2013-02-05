"use strict";

var path            = require('path')
  , ParsedStatement = require(path.join(__dirname, '..', 'db', 'parsed-statement'))
  , shimmer         = require(path.join(__dirname, '..', 'shimmer'))
  , logger          = require(path.join(__dirname, '..',
                                        'logger')).child({component : 'mongodb'})
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
  return function (operation) {
    // each throws without a callback parameter.
    return agent.tracer.callbackProxy(function (callback) {
      var wrapped = agent.tracer.callbackProxy(function () {
        // cursor is done when its callback is called with null
        if (!arguments[1]) {
          logger.trace("MongoDB query trace segment ended.");
          segment.end();
        }

        return callback.apply(this, arguments);
      });

      return operation.call(this, wrapped);
    });
  };
}

function addMongoStatement(state, collection, operation) {
  var statement = new ParsedStatement(operation, collection)
    , recorder  = statement.recordMetrics.bind(statement)
    , metric    = 'MongoDB/' + collection + '/' + operation
    , next      = state.getSegment().add(metric, recorder)
    ;

  state.setSegment(next);

  return next;
}

module.exports = function initialize(agent, mongodb) {
  [ 'insert', // C: mongo.Db._executeInsertCommand
    'find',   // R: mongo.Db._executeQueryCommand
    'update', // U: mongo.Db._executeUpdateCommand === _executeInsertCommand
    'remove'  // D: mongo.Db._executeRemoveCommand === _executeInsertCommand
  ].forEach(function (operation) {
    shimmer.wrapMethod(mongodb && mongodb.Collection && mongodb.Collection.prototype,
                       'mongodb.Collection.prototype', operation, function (command) {
      return agent.tracer.segmentProxy(function () {
        var state      = agent.getState()
          , collection = this.collectionName || 'unknown'
          , terms      = typeof arguments[0] === 'function' ? undefined : arguments[0]
          , callback   = arguments[arguments.length - 1]
          ;

        if (!state || arguments.length < 1) {
          logger.trace("Not tracing MongoDB operation %s on %s; no transaction.",
                       operation,
                       collection);
          if (terms) logger.trace({terms : terms}, "With terms:");

          return command.apply(this, arguments);
        }

        logger.trace("Tracing MongoDB %s.%s(%j).",
                     collection,
                     operation,
                     terms);

        var segment = addMongoStatement(state, collection, operation);
        if (typeof terms === 'object') segment.parameters = terms;

        if (typeof callback !== 'function') {
          // no callback, so wrap the cursor iterator
          var cursor = command.apply(this, arguments);
          shimmer.wrapMethod(cursor, 'cursor', 'each', wrapEach(segment, agent));
          return cursor;
        }
        else {
          var args = Array.prototype.slice.call(arguments);

          args[args.length - 1] = agent.tracer.callbackProxy(function () {
            var returned = callback.apply(this, arguments);

            segment.end();
            logger.trace("Tracing MongoDB %s.%s(%j) ended for transaction %s.",
                         collection,
                         operation,
                         terms,
                         state.getTransaction().id);

            return returned;
          });

          return command.apply(this, args);
        }
      });
    });
  });
};
