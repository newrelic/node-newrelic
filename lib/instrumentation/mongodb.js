"use strict";

var path            = require('path')
  , ParsedStatement = require(path.join(__dirname, '..', 'db', 'parsed-statement'))
  , shimmer         = require(path.join(__dirname, '..', 'shimmer'))
  , logger          = require(path.join(__dirname, '..',
                                        'logger')).child({component : 'mongodb'})
  , MONGODB         = require(path.join(__dirname, '..', 'metrics', 'names')).MONGODB
  ;

var INSTRUMENTED_OPERATIONS = [
  'find',
  'findOne',
  'insert',
  'remove',
  'save',
  'update',
  'distinct',
  'count',
  'findAndModify',
  'findAndRemove',
  'createIndex',
  'ensureIndex',
  'dropIndex',
  'dropAllIndexes',
  'reIndex'
];

/**
 * Everything uses nextObject, whether you're streaming or using callbacks.
 *
 * @param {TraceSegment} segment The current segment, to be closed when done.
 * @param {Tracer}       tracer  The current transaction trcer.
 *
 * @returns {Function} A callback that further wraps the callback called by the
 *                     wrapped nextObject method, so we can tell when the cursor
 *                     is exhausted.
 */
function wrapNextObject(segment, tracer) {
  return function (nextObject) {
    return function wrappedNextObject() {
      var args     = tracer.slice(arguments)
        , last     = args.length - 1
        , callback = args[last]
        , cursor   = this
        ;

      if (typeof callback === 'function') {
        args[last] = tracer.callbackProxy(function (err, object) {
          var collection = cursor.collection.collectionName || 'unknown'
            , remaining  = cursor.items.length
            , total      = cursor.totalNumberOfRecords
            , limit      = cursor.limitValue === -1 ? 1 : cursor.limitValue
            , returned   = callback.apply(this, arguments)
            ;

          if (remaining === 0 && limit === total) {
            segment.end();
            logger.trace("MongoDB query trace segment ended for %s: end of batch.",
                         collection);
          }
          else if (!object ) {
            segment.end();
            logger.trace("MongoDB query trace segment ended for %s: nothing to pull.",
                         collection);
          }

          return returned;
        });
      }

      return nextObject.apply(this, args);
    };
  };
}

function addMongoStatement(state, collection, operation) {
  var statement = new ParsedStatement(MONGODB.PREFIX, operation, collection)
    , recorder  = statement.recordMetrics.bind(statement)
    , name      = MONGODB.STATEMENT + collection + '/' + operation
    , next      = state.getSegment().add(name, recorder)
    ;

  state.setSegment(next);

  return next;
}

module.exports = function initialize(agent, mongodb) {
  if (!(mongodb && mongodb.Collection && mongodb.Collection.prototype)) return;

  var tracer = agent.tracer;

  INSTRUMENTED_OPERATIONS.forEach(function (operation) {
    shimmer.wrapMethod(mongodb.Collection.prototype,
                       'mongodb.Collection.prototype', operation, function (command) {
      return tracer.segmentProxy(function () {
        var state      = tracer.getState()
          , collection = this.collectionName || 'unknown'
          , args       = tracer.slice(arguments)
          , terms      = typeof args[0] === 'function' ? undefined : args[0]
          ;

        if (!state || args.length < 1) {
          logger.trace("Not tracing MongoDB %s.%s(); no transaction or parameters.",
                       collection, operation);
          if (terms) logger.trace({terms : terms}, "With terms:");

          return command.apply(this, arguments);
        }

        logger.trace("Tracing MongoDB %s.%s(%j).", collection, operation, terms);

        /* Don't add segments when MongoDB is calling back into itself.
         * Mildly heuristic: MongoDB operations that self-call do so on the
         * same tick, so if a MongoDB operation has already happened this
         * tick (according to the tracer), then it's a self-call.
         */
        if (!tracer.isCurrentSegmentType(MONGODB.PREFIX)) {
          tracer.setCurrentSegmentType(MONGODB.PREFIX);
          var segment = addMongoStatement(state, collection, operation);
          if (typeof terms === 'object') segment.parameters = terms;

          // capture configuration information if available
          if (this.db && this.db.serverConfig) {
            segment.host = this.db.serverConfig.host;
            segment.port = this.db.serverConfig.port;
          }

          var callback = args.pop();
          if (typeof callback !== 'function') {
            args.push(callback);
            if (operation === 'find') {
              // no callback, so wrap the cursor iterator
              var cursor = command.apply(this, args);
              shimmer.wrapMethod(cursor, 'cursor', 'nextObject',
                                 wrapNextObject(segment, tracer));

              return cursor;
            }
            else {
              args.push(tracer.callbackProxy(function () {
                segment.end();
                logger.trace("Tracing MongoDB %s.%s(%j) ended for transaction %s.",
                             collection, operation, terms, state.getTransaction().id);
              }));
            }
          }
          else {
            if (operation === 'find') {
              args.push(tracer.callbackProxy(function (err, cursor) {
                if (cursor) {
                  shimmer.wrapMethod(cursor, 'cursor', 'nextObject',
                                     wrapNextObject(segment, tracer));
                }

                return callback.apply(this, arguments);
              }));
            }
            else {
              args.push(tracer.callbackProxy(function () {
                var returned = callback.apply(this, arguments);

                segment.end();
                logger.trace("Tracing MongoDB %s.%s(%j) ended for transaction %s.",
                             collection, operation, terms, state.getTransaction().id);

                return returned;
              }));
            }
          }
        }

        return command.apply(this, args);
      });
    });
  });
};
