'use strict'

var path            = require('path')
  , ParsedStatement = require('../db/parsed-statement')
  , shimmer         = require('../shimmer')
  , urltils         = require('../util/urltils')
  , logger          = require('../logger').child({component : 'mongodb'})
  , MONGODB         = require('../metrics/names').MONGODB
  

var COLLECTION_OPERATIONS = [
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
]

/**
 * Mongo operations fall into two categories: cursor and collection operations.
 * Cursor operations iterate through query results. This includes
 * Cursor.toArray(), .each(), and .nextObject(). Collection operations are those
 * called on collection objects.
 *
 * In particular, both cursor and collection operations may be called by parent
 * collection operations. Cursor.nextObject() may also be called within any of
 * the cursor operations.
 *
 * The following functions return whether the current segment is any MongoDB
 * operation, a cusor operation, or a collection operation.
 */
var MONGO_RE = new RegExp('^' + MONGODB.STATEMENT)
function isCurrentSegmentMongo(tracer) {
  var segment = tracer.getSegment()
  return MONGO_RE.test(segment.name)
}

var CURSOR_RE = new RegExp('^' + MONGODB.STATEMENT + '.*/find$')
function isCurrentSegmentCursorOp(tracer) {
  var segment = tracer.getSegment()
  return CURSOR_RE.test(segment.name)
}

var COLLECTION_RE = new RegExp('^' + MONGODB.STATEMENT + '(?!.*\/find$)')
function isCurrentSegmentCollectionOp(tracer) {
  var segment = tracer.getSegment()
  return COLLECTION_RE.test(segment.name)
}

/**
 * Since collection operations may call other collection operations under the
 * covers, we must distinguish between the two following scenarios:
 *
 * - findAndRemove() calls findAndModify() under the covers
 * - Callback of operation calls a new operation
 *
 * The way to tell is to track whether the first collection operation has
 * completed and is in a callback when the second operation begins.
 *
 * The following function returns whether the current segment has finished
 * the transaction and is now in a callback.
 */
function isCurrentSegmentInCallbackState(tracer) {
  return tracer.getSegment().isInCallbackState()
}

/**
 * There's the possibility that one cursor operation spawns another cursor
 * operation. We must distinguish between the two following scenarios:
 *
 * - nextObject() callback calls nextObject() again to iterate through the
 *   same query results.
 * - nextObject() callback issues a new query and cursor operation
 *
 * To distinguish between the two, we track whether we are already monitoring a
 * given cursor operation.
 *
 * The following functions enable registering, deregistering, and checking if we
 * are tracking a cursor operation.
 */
var cursorTracker = (function CursorTracker() {
  var activeCursors = {}
  var nextCursorId = 1

  return {
    track: function track(cursor, segment) {
      if (!cursor.__NR_segment_id) cursor.__NR_segment_id = nextCursorId++
      activeCursors[cursor.__NR_segment_id] = segment
    },

    untrack: function untrack(cursor) {
      if (cursor.__NR_segment_id) {
        delete activeCursors[cursor.__NR_segment_id]
        delete cursor.__NR_segment_id
      }
    },

    trackedSegment: function trackedSegment(cursor) {
      return cursor.__NR_segment_id && activeCursors[cursor.__NR_segment_id]
    }
  }
}())

/**
 * Wrap Cursor iterator operations as results can be returned in a callback.
 *
 * @param {Tracer}     tracer  The current transaction tracer.
 * @param {string}     operation  The name of the Cursor operation
 *
 * @returns {Function} A CLS wrapped callback.
 */
function wrapCursorOperation(tracer, operationName) {
  return function cls_wrapCursorOperation(operation) {
    return tracer.segmentProxy(function mongoCursorOperationProxy() {
      var cursor = this
      var collection = cursor.collection.collectionName
      var terms = cursor.selector

      if (!tracer.getTransaction()) {
        logger.trace('Not tracing MongoDB %s.%s(%j); no New Relic transaction.',
                     collection, operationName, terms)
        return operation.apply(this, arguments)
      }

      var args = tracer.slice(arguments)
      var last = args.length - 1
      var callback = args[last]

      if (typeof callback !== 'function') {
        logger.trace('Not tracing MongoDB %s.%s(%j); last argument was not a callback.',
                     collection, operationName, terms)
        return operation.apply(this, arguments)
      }

      // Conditions in which we allow a cursor operation to be tracked as a
      // segment:
      //
      // - Current segment isn't a MongoDB segment
      // - Current segment is a collection operation, but it has finished and
      //   we are now in its callback
      // - Current segment is a cursor operation, but this is operation is for a
      //   cursor we don't already track

      var currentIsntMongo = !isCurrentSegmentMongo(tracer)

      var currentIsCollectionOperationInCallback = (
        isCurrentSegmentCollectionOp(tracer) &&
        isCurrentSegmentInCallbackState(tracer)
      )

      var currentIsCursorOperationAndThisCursorIsNew = (
        isCurrentSegmentCursorOp(tracer) &&
        !cursorTracker.trackedSegment(cursor)
      )

      if (currentIsntMongo ||
          currentIsCollectionOperationInCallback ||
          currentIsCursorOperationAndThisCursorIsNew) {
        logger.trace('Tracing MongoDB %s.%s(%j).', collection, operation, terms)

        addMongoStatement(tracer, collection, 'find')
        var segment = tracer.getSegment()
        cursorTracker.track(cursor, segment)

        // capture configuration information if available
        if (cursor.db && cursor.db.serverConfig) {
          segment.host = cursor.db.serverConfig.host
          segment.port = cursor.db.serverConfig.port
        }
      } else {
        logger.trace('Not tracing MongoDB %s.%s(%j); MongoDB segment already in progress.',
                     collection, operationName, terms)
      }

      args[last] = tracer.callbackProxy(function cursorOperationCbProxy() {
        var ret = callback.apply(this, arguments)

        // If we are monitoring this segment/cursor and the cursor is now
        // closed, end the transaction. We have to check this because the driver
        // in many cases moves a cursor to the closed state without actually
        // calling Cursor.close().
        var segment = cursorTracker.trackedSegment(cursor)
        if (segment && cursor.state === cursor.constructor.CLOSED) {
          logger.trace('Tracing MongoDB %s.%s(%j) ended.',
                       collection, operation, terms)

          cursorTracker.untrack(cursor)
          segment.end()
        }

        return ret
      })

      operation.apply(this, args)
    })
  }
}

/**
 * When Cursor.close() is called, the cursor is done and any associated segments
 * should be ended. Cursor.close() may be called by the consumer of the driver
 * as part of the API, or through internal calls as part of results processing.
 */
function wrapCursorClose(tracer) {
  return function cls_wrapCursorClose(close) {
    return function wrappedCursorClose() {
      var cursor = this
      var segment = cursorTracker.trackedSegment(cursor)

      if (segment) {
        logger.trace('Tracing MongoDB ended via Cursor.close().')
        cursorTracker.untrack(cursor)
        segment.end()
      }

      return close.apply(this, arguments)
    }
  }
}

function addMongoStatement(tracer, collection, operation) {
  var statement = new ParsedStatement(MONGODB.PREFIX, operation, collection)
    , recorder  = statement.recordMetrics.bind(statement)
    , name      = MONGODB.STATEMENT + collection + '/' + operation
    

  return tracer.addSegment(name, recorder)
}

module.exports = function initialize(agent, mongodb) {
  if (!(mongodb && mongodb.Collection && mongodb.Collection.prototype)) return

  var tracer = agent.tracer

  if (mongodb && mongodb.Cursor && mongodb.Cursor.prototype) {
    shimmer.wrapMethod(mongodb.Cursor.prototype,
                       'mongodb.Cursor.prototype',
                       'toArray', wrapCursorOperation(tracer, 'toArray'))
    shimmer.wrapMethod(mongodb.Cursor.prototype,
                       'mongodb.Cursor.prototype',
                       'each', wrapCursorOperation(tracer, 'each'))
    shimmer.wrapMethod(mongodb.Cursor.prototype,
                       'mongodb.Cursor.prototype',
                       'nextObject', wrapCursorOperation(tracer, 'nextObject'))
    shimmer.wrapMethod(mongodb.Cursor.prototype,
                       'mongodb.Cursor.prototype',
                       'close', wrapCursorClose(tracer))
  }

  COLLECTION_OPERATIONS.forEach(function cb_forEach(operation) {
    shimmer.wrapMethod(mongodb.Collection.prototype,
                       'mongodb.Collection.prototype', operation, function cls_MONGO_OPERATION(command) {
      return tracer.segmentProxy(function cb_segmentProxy() {
        var collection = this.collectionName || 'unknown'
          , args       = tracer.slice(arguments)
          , terms      = typeof args[0] === 'function' ? undefined : args[0]
          

        if (args.length < 1) {
          logger.trace('Not tracing MongoDB %s.%s(); no command parameters.',
                       collection, operation)

          return command.apply(this, arguments)
        }
        else if (!tracer.getTransaction()) {
          logger.trace('Not tracing MongoDB %s.%s(); no New Relic transaction.',
                       collection, operation)
          if (terms) logger.trace({terms : terms}, 'With terms:')

          return command.apply(this, arguments)
        }

        // Don't add segments when MongoDB is calling back into itself
        // internally.
        if (!isCurrentSegmentCollectionOp(tracer) ||
            isCurrentSegmentInCallbackState(tracer)) {
          logger.trace('Tracing MongoDB %s.%s(%j).', collection, operation,
                       terms)

          var transaction = tracer.getTransaction()
            , segment     = addMongoStatement(tracer, collection, operation)
            

          if (typeof terms === 'object') {
            urltils.copyParameters(agent.config, terms, segment.parameters)
          }

          // capture configuration information if available
          if (this.db && this.db.serverConfig) {
            segment.host = this.db.serverConfig.host
            segment.port = this.db.serverConfig.port
          }

          var callback = args.pop()
          if (typeof callback !== 'function') {
            args.push(callback)
            args.push(tracer.callbackProxy(function cb_callbackProxy() {
              segment.moveToCallbackState()

              segment.end()
              logger.trace('Tracing MongoDB %s.%s(%j) ended.',
                           collection, operation, terms)
            }))
          }
          else {
            args.push(tracer.callbackProxy(function cb_callbackProxy() {
              segment.moveToCallbackState()

              var returned = callback.apply(this, arguments)

              segment.end()
              logger.trace('Tracing MongoDB %s.%s(%j) ended.',
                           collection, operation, terms)

              return returned
            }))
          }
        } else {
          logger.trace('Not tracing MongoDB %s.%s(%j); MongoDB segment already in progress.',
                       collection, operation, terms)
        }

        return command.apply(this, args)
      })
    })
  })
}
