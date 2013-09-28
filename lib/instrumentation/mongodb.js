"use strict";

var path            = require('path')
  , ParsedStatement = require(path.join(__dirname, '..', 'db', 'parsed-statement'))
  , shimmer         = require(path.join(__dirname, '..', 'shimmer'))
  , logger          = require(path.join(__dirname, '..',
                                        'logger')).child({component : 'mongodb'})
  , MONGODB         = require(path.join(__dirname, '..', 'metrics', 'names')).MONGODB
  ;

var COLLECTION_OPERATIONS = [
  'insert',
  'remove',
  'save',
  'update',
  // 'distinct',
  'count',
  'findAndModify',
  'findAndRemove',
  // 'createIndex',
  // 'ensureIndex',
  // 'dropIndex',
  // 'reIndex'
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
  var statement = new ParsedStatement(operation, collection)
    , recorder  = statement.recordMetrics.bind(statement)
    , name      = MONGODB.PREFIX + collection + '/' + operation
    , next      = state.getSegment().add(name, recorder)
    ;

  state.setSegment(next);

  return next;
}

module.exports = function initialize(agent, mongodb) {
  if (!(mongodb && mongodb.Collection && mongodb.Collection.prototype)) return;

  var tracer = agent.tracer;

  shimmer.wrapMethod(mongodb.Collection.prototype, 'mongodb.Collection.prototype',
                     'find', function (find) {
    return tracer.segmentProxy(function () {
      var state      = tracer.getState()
        , collection = this.collectionName || 'unknown'
        , terms      = typeof arguments[0] === 'function' ? undefined : arguments[0]
        ;

      if (!state || arguments.length < 1) {
        logger.trace("Not tracing MongoDB %s.find(); no transaction or parameters.",
                     collection);
        if (terms) logger.trace({terms : terms}, "With terms:");

        return find.apply(this, arguments);
      }

      logger.trace("Tracing MongoDB %s.find(%j).", collection, terms);

      var segment = addMongoStatement(state, collection, 'find');
      if (typeof terms === 'object') segment.parameters = terms;

      var args = tracer.slice(arguments);
      var callback = args.pop();
      if (typeof callback !== 'function') {
        args.push(callback);
        // no callback, so wrap the cursor iterator
        var cursor = find.apply(this, args);
        shimmer.wrapMethod(cursor, 'cursor', 'nextObject',
                           wrapNextObject(segment, tracer));

        return cursor;
      }
      else {
        args.push(tracer.callbackProxy(function (err, cursor) {
          if (cursor) {
            shimmer.wrapMethod(cursor, 'cursor', 'nextObject',
                               wrapNextObject(segment, tracer));
          }

          return callback.apply(this, arguments);
        }));

        return find.apply(this, args);
      }
    });
  });

  COLLECTION_OPERATIONS.forEach(function (operation) {
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

        logger.trace("Tracing MongoDB %s.%s(%j).",
                     collection, operation, terms);

        var segment = addMongoStatement(state, collection, operation);
        if (typeof terms === 'object') segment.parameters = terms;

        var callback = args.pop();
        if (typeof callback !== 'function') {
          args.push(callback);
          args.push(tracer.callbackProxy(function () {
            segment.end();
            logger.trace("Tracing MongoDB %s.%s(%j) ended for transaction %s.",
                         collection, operation, terms, state.getTransaction().id);
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

        return command.apply(this, args);
      });
    });
  });
};
