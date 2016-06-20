'use strict'

var logger = require('../logger.js').child({shim: 'DatastoreShim'})
var metrics = require('../metrics/names')
var parseSql = require('../db/parse-sql')
var Shim = require('./shim')
var util = require('util')

var DATASTORE_METRICS = {
  CASSANDRA: 'Cassandra',
  MYSQL: 'MySQL',
  REDIS: 'Redis'
}

/**
 * Constructs a shim associated with the given agent instance, specialized for
 * instrumenting datastores.
 *
 * @constructor
 * @classdesc
 *  A helper class for wrapping datastore modules.
 *
 * @param {Agent} agent
 *  The agent this shim will use.
 *
 * @param {string} [datastore]
 *  The name of datastore. Use one of the well-known constants if available for
 *  this datastore.
 */
function DatastoreShim(agent, datastore) {
  Shim.call(this, agent)
  this._logger = logger
  if (datastore) {
    this.setDatastore(datastore)
  }
}
module.exports = DatastoreShim

util.inherits(DatastoreShim, Shim)

// Add constants on the shim for the well-known datastores.
Object.keys(DATASTORE_METRICS).forEach(function defineDatastoreMetricEnum(dsName) {
  Shim.defineProperty(DatastoreShim, dsName, DATASTORE_METRICS[dsName])
  Shim.defineProperty(DatastoreShim.prototype, dsName, DATASTORE_METRICS[dsName])
})

Shim.defineProperty(DatastoreShim.prototype, 'logger', function getLogger() {
  return this._logger
})

DatastoreShim.prototype.setDatastore = setDatastore
DatastoreShim.prototype.recordOperation = recordOperation
DatastoreShim.prototype.recordQuery = recordQuery
DatastoreShim.prototype.recordBatchQuery = recordBatchQuery
DatastoreShim.prototype.parseQuery = parseQuery

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
 */

/**
 * @callback QueryFunction
 *
 * @summary
 *  Pulls the query argument out from an array of aruguments.
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
 * @return {string} The query in the arguments list.
 */

/**
 * @typedef {Object} OperationSpec
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
 */

/**
 * @typedef {Object} QuerySpec
 * @extends OperationSpec
 *
 * @description
 *  Describes the interface for a query function.
 *
 * @property {bool} stream
 *  If `true`, the return value will be wrapped as a stream.
 *
 * @property {number|string|QueryFunction} query
 *  If a number, it is the offset in the arguments array for the query string
 *  argument. If a string, it is the query being executed. If a function, it
 *  will be passed the arguments and must return the query string.
 */

/**
 * @typedef {Object} DatastoreExtras
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
 *  The name of this datastore. Use one of the well-known constants if available
 *  for the datastore.
 */
function setDatastore(datastore) {
  this._metrics = {
    PREFIX: datastore,
    STATEMENT: metrics.DB.STATEMENT + '/' + datastore + '/',
    OPERATION: metrics.DB.OPERATION + '/' + datastore + '/',
    INSTANCE: metrics.DB.INSTANCE + '/' + datastore + '/'
  }

  this._logger = logger.child({datastore: this._metrics.PREFIX})
  this.logger.trace({metrics: this._metrics}, 'Datastore metric names set')
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

    // Adjust the segment name with the metric prefix.
    segDesc.name = shim._metrics.OPERATION + '/' + segDesc.name

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
 * @param {QuerySpec|QueryFunction} querySpec
 *  The spec for this query function.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 */
function recordQuery(nodule, properties, querySpec) {
  return _recordQuery.call(this, '', nodule, properties, querySpec)
}

/**
 * Just like `DatastoreShim#query`, but with a `batch` suffix for the recorded
 * metric.
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
 * @param {QuerySpec|QueryFunction} querySpec
 *  The spec for this query function.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 */
function recordBatchQuery(nodule, properties, querySpec) {
  return _recordQuery.call(this, '/batch', nodule, properties, querySpec)
}

/**
 * Parses the given query to extract information for any metrics that will be
 * created.
 *
 * @param {string} query - The query to parse.
 *
 * @return {ParsedStatement} The parsed query object.
 */
function parseQuery(query) {
  return parseSql(this._metrics.PREFIX, query)
}

/**
 * Wraps the given properties as datastore query that should be recorded.
 *
 * - `_recordQuery(suffix, nodule, properties, querySpec)`
 * - `_recordQuery(suffix, func, querySpec)`
 *
 * The resulting wrapped methods will record their actions using the datastore
 * `STATEMENT` metric.
 *
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
    shim.logger.trace('Determining query information for ', fnName)

    var queryDesc = querySpec
    if (shim.isFunction(querySpec)) {
      queryDesc = querySpec.call(this, shim, fn, fnName, args)
    }

    // Fetch the query string.
    var queryStr = queryDesc.query
    if (shim.isNumber(queryStr)) {
      var queryIdx = shim.normalizeIndex(args.length, queryStr)
      if (queryIdx === null) {
        return null
      }
      queryStr = args[queryIdx]
    } else if (shim.isFunction(queryStr)) {
      queryStr = queryStr.call(this, shim, fn, fnName, args)
    }
    if (!shim.isString(queryStr)) {
      return null
    }
    shim.logger.trace('Found query %s', queryStr)

    // Parse the query and assemble the name.
    var parsed = shim.parseQuery(queryStr)
    var name = (parsed.model || 'other') + '/' + parsed.operation + suffix

    // Return the segment descriptor.
    return {
      name: shim._metrics.STATEMENT + name,
      extras: queryDesc.extras,
      callback: queryDesc.callback,
      stream: queryDesc.stream,
      recorder: function queryRecorder(segment, scope) {
        if (segment) {
          parsed.recordMetrics(segment, scope)
        }
      }
    }
  })
}
