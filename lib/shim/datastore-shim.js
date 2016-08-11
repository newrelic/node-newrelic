'use strict'

var logger = require('../logger.js').child({component: 'DatastoreShim'})
var metrics = require('../metrics/names')
var parseSql = require('../db/query-parsers/sql.js')
var ParsedStatement = require('../db/parsed-statement')
var Shim = require('./shim')
var util = require('util')

/**
 * An enumeration of well-known datastores so that new instrumentations can use
 * the same names we already use for first-party instrumentation.
 *
 * Each of these values is also exposed directly on the DatastoreShim class as
 * static members.
 *
 * @readonly
 * @memberof DatastoreShim
 * @enum {string}
 */
var DATASTORE_NAMES = {
  CASSANDRA: 'Cassandra',
  MONGODB: 'MongoDB',
  MYSQL: 'MySQL',
  REDIS: 'Redis',
  POSTGRES: 'Postgres'
}

var defaultParsers = {
  'SQL': parseSql
}

/**
 * Pre-defined query parsers for well-known languages.
 *
 * Each of these values is also exposed directly on the DatastoreShim class as
 * static members.
 *
 * @readonly
 * @memberof DatastoreShim
 * @enum {string}
 */
var QUERY_PARSERS = {
  SQL_PARSER: 'SQL'
}

/**
 * Constructs a shim associated with the given agent instance, specialized for
 * instrumenting datastores.
 *
 * @constructor
 * @extends Shim
 * @classdesc
 *  A helper class for wrapping datastore modules.
 *
 * @param {Agent} agent
 *  The agent this shim will use.
 *
 * @param {string} moduleName
 *  The name of the module being instrumented.
 *
 * @param {string} [datastoreId]
 *  The name of the datastore being instrumented. If available, use one of the
 *  values from {@link DatastoreShim.DATASTORE_NAMES}.
 *
 * @see Shim
 * @see DatastoreShim.DATASTORE_NAMES
 */
function DatastoreShim(agent, moduleName, datastoreId) {
  Shim.call(this, agent, moduleName)
  this._logger = logger.child({module: moduleName})
  if (datastoreId) {
    this.setDatastore(datastoreId)
  }
  this.queryParser = defaultParsers[this.SQL_PARSER]
}
module.exports = DatastoreShim

util.inherits(DatastoreShim, Shim)

// Add constants on the shim for the well-known datastores.
DatastoreShim.DATASTORE_NAMES = DATASTORE_NAMES
Object.keys(DATASTORE_NAMES).forEach(function defineDatastoreMetricEnum(dsName) {
  Shim.defineProperty(DatastoreShim, dsName, DATASTORE_NAMES[dsName])
  Shim.defineProperty(DatastoreShim.prototype, dsName, DATASTORE_NAMES[dsName])
})

// Add constants on the shim for the provided query parsers.
DatastoreShim.QUERY_PARSERS = QUERY_PARSERS
Object.keys(QUERY_PARSERS).forEach(function defineQueryParserEnum(qpName) {
  Shim.defineProperty(DatastoreShim, qpName, QUERY_PARSERS[qpName])
  Shim.defineProperty(DatastoreShim.prototype, qpName, QUERY_PARSERS[qpName])
})

DatastoreShim.prototype.setDatastore = setDatastore
DatastoreShim.prototype.recordOperation = recordOperation
DatastoreShim.prototype.recordQuery = recordQuery
DatastoreShim.prototype.recordBatchQuery = recordBatchQuery
DatastoreShim.prototype.parseQuery = parseQuery
DatastoreShim.prototype.setParser = setParser
DatastoreShim.prototype.bindRowCallbackSegment = bindRowCallbackSegment

// -------------------------------------------------------------------------- //

/**
 * @callback QuerySpecFunction
 *
 * @summary
 *  Used for determining information about a query when it can not be simply
 *  found in the arguments.
 *
 * @param {Shim} shim
 *  The shim this function was passed to.
 *
 * @param {Function} func
 *  The function being recorded.
 *
 * @param {string} name
 *  The name of the function.
 *
 * @param {Array.<*>} args
 *  The arguments being passed into the function.
 *
 * @return {QuerySpec} The spec for how this query should be recorded.
 *
 * @see DatastoreShim#recordQuery
 * @see DatastoreShim#recordBatchQuery
 * @see QuerySpec
 */

/**
 * @callback QueryFunction
 *
 * @summary
 *  Pulls the query argument out from an array of arguments.
 *
 * @param {Shim} shim
 *  The shim this function was passed to.
 *
 * @param {Function} func
 *  The function being recorded.
 *
 * @param {string} name
 *  The name of the function.
 *
 * @param {Array.<*>} args
 *  The arguments being passed into the function.
 *
 * @return {string} The query string from the arguments list.
 *
 * @see QuerySpec
 * @see QuerySpecFunction
 */

/**
 * @callback QueryParserFunction
 *
 * @summary
 *  Used to parse queries to extract the basic information about it.
 *
 * @param {string} query - The query to be parsed.
 *
 * @return {ParsedQueryData} An object containing the basic information about
 *  the query.
 *
 * @see DatastoreShim#setParser
 * @see ParsedQueryData
 */

/**
 * @callback QueryParserFunction
 *
 * @summary
 *  Used to parse queries to extract the basic information about it.
 *
 * @param {string} query - The query to be parsed.
 *
 * @return {ParsedQueryData} An object containing the basic information about
 *  the query.
 */

/**
 * @interface OperationSpec
 *
 * @description
 *  Describes the interface for an operation function.
 *
 * @property {string} [name]
 *  The name for this operation. If omitted, the operation function's name will
 *  used instead.
 *
 * @property {DatastoreExtras} [extras]
 *  Extra parameters to be set on the metric for the operation.
 *
 * @property {number|CallbackBindFunction} callback
 *  If a number, it is the offset in the arguments array for the operation's
 *  callback argument. If it is a function, it should perform the segment
 *  binding to the callback.
 *
 * @see QuerySpec
 */

/**
 * @interface QuerySpec
 * @extends OperationSpec
 *
 * @description
 *  Describes the interface for a query function. Extends {@link OperationSpec}
 *  with query-specific parameters.
 *
 * @property {bool} [stream=false]
 *  If `true`, the return value will be wrapped as a stream.
 *
 * @property {number|string|QueryFunction} query
 *  If a number, it is the offset in the arguments array for the query string
 *  argument. If a string, it is the query being executed. If a function, it
 *  will be passed the arguments and must return the query string.
 *
 * @see DatastoreShim#recordQuery
 * @see DatastoreShim#recordBatchQuery
 * @see QuerySpecFunction
 * @see QueryFunction
 * @see OperationSpec
 */

/**
 * @interface DatastoreExtras
 *
 * @description
 *  Extra parameters which may be added to an operation or query segment. All of
 *  these properties are optional.
 *
 * @property {string} host
 *  The host of the database server being interacted with.
 *
 * @property {number} port
 *  The port number being connected to.
 *
 * @property {Object} parameters
 *  The query parameters (i.e. placeholder values).
 *
 * @see OperationSpec
 */

/**
 * @interface ParsedQueryData
 *
 * @description
 *  Returned by a {@link QueryParserFunction}, this information is used to
 *  generate the name for recording datastore queries.
 *
 * @property {string} operation
 *  The datastore operation such as `SELECT` or `UPDATE`.
 *
 * @property {string} model
 *  The model being queried. This would be the table name from a SQL statement
 *  or the collection name in a MongoDB query.
 *
 * @property {string} [query]
 *  The query with any sensitive information redacted and comments removed.
 *
 * @see DatastoreShim#setParser
 * @see QueryParserFunction
 */

/**
 * @typedef {Object} ParsedQueryData
 *
 * @description
 *  Returned by a `QueryParserFunction`, this information is used to generate
 *  the name for recording datastore queries.
 *
 * @property {string} operation
 *  The datastore operation such as `SELECT` or `UPDATE`.
 *
 * @property {string} model
 *  The model being queried. This would be the table name from a SQL statement
 *  or the collection name in a MongoDB query.
 *
 * @property {string} query
 *  The query with any sensitive information redacted and comments removed.
 */

/**
 * @typedef {Object} ParsedQueryData
 *
 * @description
 *  Returned by a `QueryParserFunction`, this information is used to generate
 *  the name for recording datastore queries.
 *
 * @property {string} operation
 *  The datastore operation such as `SELECT` or `UPDATE`.
 *
 * @property {string} model
 *  The model being queried. This would be the table name from a SQL statement
 *  or the collection name in a MongoDB query.
 *
 * @property {string} query
 *  The query with any sensitive information redacted and comments removed.
 */

// -------------------------------------------------------------------------- //

/**
 * Sets the vendor the module implements.
 *
 * This is used to determine the names for metrics and segments. If a string is
 * passed, metric names will be generated using that name.
 *
 * @memberof DatastoreShim.prototype
 *
 * @param {string} datastore
 *  The name of this datastore. Use one of the well-known constants listed in
 *  {@link DatastoreShim.DATASTORE_NAMES} if available for the datastore.
 *
 * @see DatastoreShim.DATASTORE_NAMES
 */
function setDatastore(datastore) {
  this._metrics = {
    PREFIX: datastore,
    STATEMENT: metrics.DB.STATEMENT + '/' + datastore + '/',
    OPERATION: metrics.DB.OPERATION + '/' + datastore + '/',
    INSTANCE: metrics.DB.INSTANCE + '/' + datastore + '/',
    ALL: metrics.DB.PREFIX + datastore + '/' + metrics.ALL
  }

  this._logger = this._logger.child({datastore: this._metrics.PREFIX})
  this.logger.trace({metrics: this._metrics}, 'Datastore metric names set')
}


/**
 * Sets the query parser used by this shim instance.
 *
 * @memberof DatastoreShim.prototype
 *
 * @param {string|QueryParserFunction} parser
 *  The string used to look up a default parser or the function used to parse
 *  queries. It is recommended that you use one of the well-known constants if
 *  available (i.e. `shim.SQL_PARSER`).
 */
function setParser(parser) {
  if (this.isString(parser)) {
    var newParser = defaultParsers[parser]
    if (newParser) {
      this.queryParser = newParser
    } else {
      this.logger.debug(
        'Attempted to set the query parser to invalid parser %s, not setting new parser',
        parser
      )
    }
  } else if (this.isFunction(parser)) {
    this.queryParser = parser
  } else {
    this.logger.trace(
      "Received invalid parser (%s)",
      parser
    )
  }
}

/**
 * Sets the query parser used by this shim instance.
 *
 * @memberof DatastoreShim.prototype
 *
 * @param {string|QueryParserFunction} parser
 *  The string used to look up a default parser or the function used to parse
 *  queries. It is recommended that you use one of the well-known constants if
 *  available in the {@link DatastoreShim.QUERY_PARSERS}.
 *
 * @see DatastoreShim.QUERY_PARSERS
 * @see QueryParserFunction
 * @see ParsedQueryData
 */
function setParser(parser) {
  if (this.isString(parser)) {
    var newParser = defaultParsers[parser]
    if (newParser) {
      this.queryParser = newParser
    } else {
      this.logger.debug(
        'Attempted to set the query parser to invalid parser %s, not setting new parser',
        parser
      )
    }
  } else if (this.isFunction(parser)) {
    this.queryParser = parser
  } else {
    this.logger.trace(
      "Received invalid parser (%s)",
      parser
    )
  }
}

/**
 * Wraps the given properties as datastore operations that should be recorded.
 *
 * - `recordOperation(nodule, properties, opSpec)`
 * - `recordOperation(func, opSpec)`
 *
 * The resulting wrapped methods will record their actions using the datastore
 * `OPERATION` metric.
 *
 * @memberof DatastoreShim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {OperationSpec|SegmentFunction} opSpec
 *  The spec for this operation function.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see Shim#wrap
 * @see Shim#record
 * @see OperationSpec
 * @see SegmentFunction
 */
function recordOperation(nodule, properties, opSpec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // operation(func, opSpec)
    opSpec = properties
    properties = null
  }
  if (!opSpec) {
    opSpec = {}
  }

  return this.record(nodule, properties, function opRecorder(shim, fn, fnName, args) {
    shim.logger.trace('Recording datastore operation "%s"', fnName)

    // Derive the segment information.
    var segDesc = null
    if (shim.isFunction(opSpec)) {
      segDesc = opSpec.call(this, shim, fn, fnName, args)
    } else {
      segDesc = {
        name: opSpec.name || fnName || 'other',
        extras: opSpec.extras,
        callback: opSpec.callback
      }
    }

    // Adjust the segment name with the metric prefix and add a recorder.
    segDesc.name = shim._metrics.OPERATION + segDesc.name
    segDesc.recorder = _recordOperationMetrics.bind(shim)

    segDesc.internal = true

    // And done.
    return segDesc
  })
}

/**
 * Wraps the given properties as datastore query that should be recorded.
 *
 * - `recordQuery(nodule, properties, querySpec)`
 * - `recordQuery(func, querySpec)`
 *
 * The resulting wrapped methods will record their actions using the datastore
 * `STATEMENT` metric.
 *
 * @memberof DatastoreShim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {QuerySpec|QuerySpecFunction} querySpec
 *  The spec for this query function.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see Shim#wrap
 * @see Shim#record
 * @see DatastoreShim#recordBatchQuery
 * @see QuerySpec
 * @see QuerySpecFunction
 */
function recordQuery(nodule, properties, querySpec) {
  return _recordQuery.call(this, '', nodule, properties, querySpec)
}

/**
 * Just like {@link DatastoreShim#recordQuery}, but with a `batch` suffix for
 * the recorded metric.
 *
 * - `recordBatchQuery(nodule, properties, querySpec)`
 * - `recordBatchQuery(func, querySpec)`
 *
 * The resulting wrapped methods will record their actions using the datastore
 * `STATEMENT` metric with a `/batch` suffix.
 *
 * @memberof DatastoreShim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {QuerySpec|QuerySpecFunction} querySpec
 *  The spec for this query function.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see Shim#wrap
 * @see Shim#record
 * @see DatastoreShim#recordQuery
 * @see QuerySpec
 * @see QuerySpecFunction
 */
function recordBatchQuery(nodule, properties, querySpec) {
  return _recordQuery.call(this, '/batch', nodule, properties, querySpec)
}

/**
 * Parses the given query to extract information for any metrics that will be
 * created.
 *
 * @memberof DatastoreShim.prototype
 *
 * @param {string} query - The query to parse.
 *
 * @param {Object} nodule - Context for the queryParse to run under.
 *
 * @return {ParsedStatement} The parsed query object.
 *
 * @see DatastoreShim#setParser
 */
function parseQuery(query, nodule) {
  var parsed = this.queryParser.call(nodule, query)
  return new ParsedStatement(
    this._metrics.PREFIX,
    parsed.operation,
    parsed.model,
    parsed.query
  )
}

/**
 * Wraps the callback in an arguments array with one that is bound to a segment.
 *
 * - `bindRowCallbackSegment(args, cbIdx [, parentSegment])`
 *
 * @memberof DatastoreShim.prototype
 *
 * @param {Array} args
 *  The arguments array to replace the callback in.
 *
 * @param {Number} cbIdx
 *  The index of the callback in the arguments array.
 *
 * @param {TraceSegment} [parentSegment]
 *  Optional. The segment to be the parent row callback's segment. Defaults to
 *  the segment active when the row callback is first called.
 */
function bindRowCallbackSegment(args, cbIdx, parentSegment) {
  var idx = this.normalizeIndex(args.length, cbIdx)
  if (idx === null) {
    this.logger.debug('Not binding row callback, invalid cbIdx %s', cbIdx)
    return
  }

  // Pull out the callback and make sure it is a function.
  var cb = args[idx]
  if (!this.isFunction(cb)) {
    this.logger.debug('Argument %d is not a function, not binding row callback', cbIdx)
    return cb
  }
  this.logger.trace('Wrapping argument %d as a row callback.', cbIdx)

  // We have a little state to maintain through potentially multiple calls.
  var callCounter = 0
  var segment = null
  var segmentName = 'Callback: ' + this.getName(cb)
  var shim = this

  var wrapper = this.bindSegment(function rowCallbackWrapper() {
    // The first time this row callback is fired we want to touch the parent
    // segment and create the callback segment.
    if (++callCounter === 1) {
      var realParent = parentSegment || shim.getSegment()
      realParent && realParent.touch()
      segment = shim.createSegment(segmentName, realParent)

      if (segment) {
        segment.async = false
      }
    }

    // Update the segment name and run the actual callback.
    if (segment) {
      segment.setParameter('count', callCounter)
    }

    return shim.applySegment(cb, segment, true, this, arguments)
  }, parentSegment)

  // Mark this as wrapped and put it in the args array.
  this.setInternalProperty(wrapper, '__NR_original', cb)
  args[idx] = wrapper
}

// -------------------------------------------------------------------------- //

/**
 * Wraps the given properties as datastore query that should be recorded.
 *
 * - `_recordQuery(suffix, nodule, properties, querySpec)`
 * - `_recordQuery(suffix, func, querySpec)`
 *
 * The resulting wrapped methods will record their actions using the datastore
 * `STATEMENT` metric.
 *
 * @private
 * @this DatastoreShim
 *
 * @param {string} suffix
 *  Suffix to be added to the segment name.
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {QuerySpec|QueryFunction} querySpec
 *  The spec for this query function.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see Shim#wrap
 * @see Shim#record
 * @see DatastoreShim#recordQuery
 * @see DatastoreShim#recordBatchQuery
 * @see QuerySpec
 * @see QuerySpecFunction
 */
function _recordQuery(suffix, nodule, properties, querySpec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // _recordQuery(suffix, func, querySpec)
    querySpec = properties
    properties = null
  }
  if (!querySpec) {
    this.logger.debug('Missing query spec for recordQuery, not wrapping.')
    return nodule
  }

  return this.record(nodule, properties, function queryRecord(shim, fn, fnName, args) {
    shim.logger.trace('Determining query information for %j', fnName)

    var queryDesc = querySpec
    if (shim.isFunction(querySpec)) {
      queryDesc = querySpec.call(this, shim, fn, fnName, args)
    }

    // Fetch the query string.
    var queryStr = _extractQueryStr.call(shim, fn, fnName, queryDesc, this, args)
    if (!shim.isString(queryStr)) {
      return null
    }
    shim.logger.trace('Found query %j', queryStr)

    // Parse the query and assemble the name.
    var parsed = shim.parseQuery(queryStr, this)
    var name = (parsed.model || 'other') + '/' + parsed.operation + suffix

    // Return the segment descriptor.
    return {
      name: shim._metrics.STATEMENT + name,
      extras:       'extras'      in queryDesc ? queryDesc.extras : null,
      callback:     'callback'    in queryDesc ? queryDesc.callback : null,
      rowCallback:  'rowCallback' in queryDesc ? queryDesc.rowCallback : null,
      stream:       'stream'      in queryDesc ? queryDesc.stream : null,
      internal:     'internal'    in queryDesc ? queryDesc.internal : true,
      recorder: function queryRecorder(segment, scope) {
        if (segment) {
          parsed.recordMetrics(segment, scope)
        }
      }
    }
  })
}

/**
 * Records all the metrics required for database operations.
 *
 * - `_recordOperationMetrics(segment [, scope])`
 *
 * @private
 * @this DatastoreShim
 * @implements {MetricFunction}
 *
 * @param {TraceSegment}  segment - The segment being recorded.
 * @param {string}        [scope] - The scope of the segment.
 *
 * @see DatastoreShim#recordOperation
 * @see MetricFunction
 */
function _recordOperationMetrics(segment, scope) {
  if (!segment) {
    return
  }

  var duration = segment.getDurationInMillis()
  var exclusive = segment.getExclusiveDurationInMillis()
  var transaction = segment.transaction
  var type = transaction.isWeb() ? 'allWeb' : 'allOther'
  var operation = segment.name

  if (scope) {
    transaction.measure(operation, scope, duration, exclusive)
  }

  transaction.measure(operation, null, duration, exclusive)
  transaction.measure(metrics.DB.PREFIX + type, null, duration, exclusive)
  transaction.measure(metrics.DB.ALL, null, duration, exclusive)
  transaction.measure(this._metrics.ALL, null, duration, exclusive)
  transaction.measure(
    metrics.DB.PREFIX + this._metrics.PREFIX + '/' + type,
    null,
    duration,
    exclusive
  )
}

/**
 * Extracts the query string from the arguments according to the given spec.
 *
 * - `_extractQueryStr(fn, fnName, spec, ctx, args)`
 *
 * @private
 * @this DatastoreShim
 *
 * @param {Function}  fn      - The query function to be executed.
 * @param {string}    fnName  - The name of the query function.
 * @param {QuerySpec} spec    - The query spec.
 * @param {*}         ctx     - The context of the query function's execution.
 * @param {Array}     args    - The arguments for the query function.
 *
 * @return {?string} The query from the arguments if found, otherwise `null`.
 */
function _extractQueryStr(fn, fnName, spec, ctx, args) {
  var queryStr = spec.query
  if (this.isNumber(queryStr)) {
    var queryIdx = this.normalizeIndex(args.length, queryStr)
    if (queryIdx === null) {
      this.logger.debug('Invalid query index %d of %d', queryStr, args.length)
      return null
    }
    queryStr = args[queryIdx]
  } else if (this.isFunction(queryStr)) {
    queryStr = queryStr.call(ctx, this, fn, fnName, args)
  }

  return queryStr
}
