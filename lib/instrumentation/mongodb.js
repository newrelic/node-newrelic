"use strict";

var path            = require('path')
  , ParsedStatement = require(path.join(__dirname, '..', 'db', 'parsed-statement'))
  , shimmer         = require(path.join(__dirname, '..', 'shimmer'))
  , logger          = require(path.join(__dirname, '..',
                                        'logger')).child({component : 'mongodb'})
  , MONGODB         = require(path.join(__dirname, '..', 'metrics', 'names')).MONGODB
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
function wrapEach(segment, tracer) {
  return function (operation) {
    // each throws without a callback parameter.
    return tracer.callbackProxy(function (callback) {
      var wrapped = tracer.callbackProxy(function () {
        // cursor is done when its callback is called with null
        if (!arguments[1]) {
          segment.end();
          logger.trace("MongoDB query trace segment ended.");
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
    , name      = MONGODB.PREFIX + collection + '/' + operation
    , next      = state.getSegment().add(name, recorder)
    ;

  state.setSegment(next);

  return next;
}

module.exports = function initialize(agent, mongodb) {
  if (!(mongodb && mongodb.Collection && mongodb.Collection.prototype)) return;

  var tracer = agent.tracer;

  // R: mongo.Db._executeQueryCommand
  shimmer.wrapMethod(mongodb.Collection.prototype, 'mongodb.Collection.prototype',
                     'count', function (count) {

    return tracer.segmentProxy(function () {
      var state      = tracer.getState()
        , collection = this.collectionName || 'unknown'
        , terms      = typeof arguments[0] === 'function' ? undefined : arguments[0]
        , args       = Array.prototype.slice.call(arguments)
        , callback   = args.pop()
        ;

      if (!state || arguments.length < 1 || typeof callback !== 'function') {
        logger.trace("Not tracing MongoDB %s.count().", collection);
        if (terms) logger.trace({terms : terms}, "With terms:");

        return count.apply(this, arguments);
      }

      logger.trace("Tracing MongoDB %s.count(%j).", collection, terms);

      var segment = addMongoStatement(state, collection, 'count');
      if (typeof terms === 'object') segment.parameters = terms;

      // FIXME: the proxied callback closes over too much state to extract
      args.push(tracer.callbackProxy(function () {
        var returned = callback.apply(this, arguments);

        segment.end();
        logger.trace("Tracing MongoDB %s.count(%j) ended for transaction %s.",
                     collection, terms, state.getTransaction().id);

        return returned;
      }));

      return count.apply(this, args);
    });
  });

  // R: mongo.Db._executeQueryCommand
  shimmer.wrapMethod(mongodb.Collection.prototype, 'mongodb.Collection.prototype',
                     'findAndModify', function (findAndModify) {

    return tracer.segmentProxy(function () {
      var state      = tracer.getState()
        , collection = this.collectionName || 'unknown'
        , terms      = typeof arguments[0] === 'function' ? undefined : arguments[0]
        , args       = Array.prototype.slice.call(arguments)
        , callback   = args.pop()
        ;

      if (!state || arguments.length < 1 || typeof callback !== 'function') {
        logger.trace("Not tracing MongoDB %s.findAndModify().", collection);
        if (terms) logger.trace({terms : terms}, "With terms:");

        return findAndModify.apply(this, arguments);
      }

      logger.trace("Tracing MongoDB %s.findAndModify(%j).", collection, terms);

      var segment = addMongoStatement(state, collection, 'find');
      if (typeof terms === 'object') segment.parameters = terms;

      // FIXME: the proxied callback closes over too much state to extract
      args.push(tracer.callbackProxy(function () {
        var returned = callback.apply(this, arguments);

        segment.end();
        logger.trace("Tracing MongoDB %s.findAndModify(%j) ended for transaction %s.",
                     collection, terms, state.getTransaction().id);

        return returned;
      }));

      return findAndModify.apply(this, args);
    });
  });

  // R: mongo.Db._executeQueryCommand
  shimmer.wrapMethod(mongodb.Collection.prototype, 'mongodb.Collection.prototype',
                     'find', function (command) {
    return tracer.segmentProxy(function () {
      var state      = tracer.getState()
        , collection = this.collectionName || 'unknown'
        , terms      = typeof arguments[0] === 'function' ? undefined : arguments[0]
        ;

      if (!state || arguments.length < 1) {
        logger.trace("Not tracing MongoDB %s.find(); no transaction or parameters.",
                     collection);
        if (terms) logger.trace({terms : terms}, "With terms:");

        return command.apply(this, arguments);
      }

      logger.trace("Tracing MongoDB %s.find(%j).", collection, terms);

      var segment = addMongoStatement(state, collection, 'find');
      if (typeof terms === 'object') segment.parameters = terms;

      var callback = arguments[arguments.length - 1];
      if (typeof callback !== 'function') {
        // no callback, so wrap the cursor iterator
        var cursor = command.apply(this, arguments);
        shimmer.wrapMethod(cursor, 'cursor', 'each', wrapEach(segment, tracer));

        return cursor;
      }
      else {
        // FIXME: the proxied callback closes over too much state to extract
        var args = Array.prototype.slice.call(arguments, 0, -1);
        args.push(tracer.callbackProxy(function () {
          var returned = callback.apply(this, arguments);

          segment.end();
          logger.trace("Tracing MongoDB %s.%s(%j) ended for transaction %s.",
                       collection, 'find', terms, state.getTransaction().id);

          return returned;
        }));

        return command.apply(this, args);
      }
    });
  });

  [ 'insert', // C: mongo.Db._executeInsertCommand
    'update', // U: mongo.Db._executeUpdateCommand === _executeInsertCommand
    'remove'  // D: mongo.Db._executeRemoveCommand === _executeInsertCommand
  ].forEach(function (operation) {
    shimmer.wrapMethod(mongodb.Collection.prototype,
                       'mongodb.Collection.prototype', operation, function (command) {
      return tracer.segmentProxy(function () {
        var state      = tracer.getState()
          , collection = this.collectionName || 'unknown'
          , args       = Array.prototype.slice.call(arguments)
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
          // FIXME: need to add callback without changing implied write concern level
          args.push(tracer.callbackProxy(function () {
            segment.end();
            logger.trace("Tracing MongoDB %s.%s(%j) ended for transaction %s.",
                         collection, operation, terms, state.getTransaction().id);
          }));
        }
        else {
          // FIXME: the proxied callback closes over too much state to extract
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
