'use strict'

var urltils = require('../util/urltils')
var logger = require('../logger').child({component: 'error_tracer'})
var NAMES = require('../metrics/names')
var errorsModule = require('./index')
var PriorityQueue = require('../priority-queue')
var WeakSet = global.WeakSet


var createError = errorsModule.createError
var createEvent = errorsModule.createEvent

module.exports = ErrorAggregator

/*
 *
 * CONSTANTS
 *
 */
var MAX_ERRORS = 20

/**
 * ErrorAggregator is responsible for collecting JS errors and errored-out HTTP
 * transactions, and for converting them to error traces and error events expected by
 * the collector.
 */
function ErrorAggregator(config) {
  this.config = config
  this.errorCount = 0
  this.webTransactionErrorCount = 0
  this.otherTransactionErrorCount = 0
  this.errors = []
  this.seenObjectsByTransaction = Object.create(null)
  this.seenStringsByTransaction = Object.create(null)

  // queue used for error events
  this.events = new PriorityQueue(this.config.error_collector.max_event_samples_stored)
}

/**
 * Every finished transaction goes through this handler, so do as
 * little as possible.
 */
ErrorAggregator.prototype.onTransactionFinished = onTransactionFinished

function onTransactionFinished(transaction, metrics) {
  if (!transaction) throw new Error('Error collector got a blank transaction.')
  if (!metrics) throw new Error('Error collector requires metrics to count errors.')
  if (transaction.ignore) {
    return
  }

  // collect user errors even if status code is ignored
  var collectedErrors = 0
  var exception
  var i
  if (transaction.userErrors.length) {
    for (i = 0; i < transaction.userErrors.length; i++) {
      exception = transaction.userErrors[i]
      if (this._collect(transaction, exception[0], exception[1], exception[2])) {
        collectedErrors++
      }
    }
  }

  var isErroredTransaction = urltils.isError(this.config, transaction.statusCode)
  var isIgnoredErrorStatusCode = urltils.isIgnoredError(this.config,
      transaction.statusCode)

  // collect other exceptions only if status code is not ignored
  if (transaction.exceptions.length && !isIgnoredErrorStatusCode) {
    for (i = 0; i < transaction.exceptions.length; i++) {
      exception = transaction.exceptions[i]
      if (this._collect(transaction, exception[0], exception[1], exception[2])) {
        collectedErrors++
      }
    }
  } else if (isErroredTransaction && this._collect(transaction)) {
    collectedErrors++
  }

  // the metric should be incremented only if the error was actually collected
  if (collectedErrors > 0) {
    var count = metrics.getOrCreateMetric(NAMES.ERRORS.PREFIX + transaction.getFullName())
    count.incrementCallCount(collectedErrors)
  }
}

/**
 * This function collects the error right away when transaction is not supplied.
 * Otherwise it delays collecting the error until the transaction ends.
 *
 * NOTE: this interface is unofficial and may change in future.
 *
 * @param {Transaction} transaction      Transaction associated with the error
 *                                       (optional).
 * @param {Error}       exception        The error to be traced.
 * @param {object}      customAttributes Any custom attributes associated with
 *                                       the request (optional).
 */
ErrorAggregator.prototype.add = function add(transaction, exception, customAttributes) {
  if (!exception) return

  var timestamp = Date.now()

  if (transaction) {
    transaction.addException(exception, customAttributes, timestamp)
  } else {
    this._collect(transaction, exception, customAttributes, timestamp)
  }
}

/**
 * This function is used to collect errors specifically added using the noticeError() API.
 * Similarly to add(), it collects the error right away when transaction is not supplied.
 * Otherwise it delays collecting the error until the transaction ends.
 * The reason for separating the API errors from other exceptions is that different ignore
 * rules apply to them.
 *
 * NOTE: this interface is unofficial and may change in future.
 *
 * @param {Transaction} transaction      Transaction associated with the error
 *                                       (optional).
 * @param {Error}       exception        The error to be traced.
 * @param {object}      customAttributes Any custom attributes associated with
 *                                       the request (optional).
 */
ErrorAggregator.prototype.addUserError = function addUserError(transaction, exception,
    customAttributes) {
  if (!exception) return

  var timestamp = Date.now()

  if (transaction) {
    transaction.addUserError(exception, customAttributes, timestamp)
  } else {
    this._collect(transaction, exception, customAttributes, timestamp)
  }
}

/**
 *
 * This function takes an exception and determines whether the exception
 * has been seen before by this aggregator.  This function mutates the
 * book keeping structures to reflect the exception has been seen.
 *
 * @param {Error} exception  The error to be checked.
 *
 */

ErrorAggregator.prototype.haveSeen = function haveSeen(transaction, exception) {
  if (!transaction) {
    transaction = {id: 'Unknown'}
  }


  if (typeof exception === 'object') {
    if (!this.seenObjectsByTransaction[transaction.id]) {
      if (WeakSet) {
        this.seenObjectsByTransaction[transaction.id] = new WeakSet()
      } else {
        this.seenObjectsByTransaction[transaction.id] = []
      }
    }

    var seenObjects = this.seenObjectsByTransaction[transaction.id]

    if (WeakSet) {
      if (seenObjects.has(exception)) {
        return true
      }

      seenObjects.add(exception)
    } else {
      if (seenObjects.indexOf(exception) !== -1) {
        return true
      }

      seenObjects.push(exception)
    }
  } else { // typeof exception !== 'object'
    if (!this.seenStringsByTransaction[transaction.id]) {
      this.seenStringsByTransaction[transaction.id] = Object.create(null)
    }

    var seenStrings = this.seenStringsByTransaction[transaction.id]
    if (seenStrings[exception]) {
      return true
    }

    seenStrings[exception] = true
  }
  return false
}

/**
 * Collects the error and also creates the error event.
 * This function uses an array of seen exceptions to ensure errors don't get
 * double-counted. It can also be used as an unofficial means of marking that
 * user errors shouldn't be traced.
 *
 * For an error to be traced, at least one of the transaction or the error
 * must be present.
 *
 * NOTE: this interface is unofficial and may change in future.
 *
 * @param {Transaction} transaction      Transaction associated with the error
 *                                       (optional).
 * @param {Error}       exception        The error to be traced (optional).
 * @param {object}      customAttributes Any custom attributes associated with
 *                                       the request (optional).
 * @returns {bool}  True if the error was collected.
 */
ErrorAggregator.prototype._collect = _collect

function _collect(transaction, exception, customAttributes, timestamp) {
  if (exception) {
    if (this.haveSeen(transaction, exception)) {
      return
    }

    if (typeof exception !== 'string' && !exception.message && !exception.stack) {
      logger.trace(exception, 'Got error that is not an instance of Error or string.')
      exception = null
    }
  }

  if (!exception && (!transaction || !transaction.statusCode || transaction.error)) {
    return
  }

  this.errorCount++

  if (transaction) {
    if (transaction.isWeb()) {
      this.webTransactionErrorCount++
    } else {
      this.otherTransactionErrorCount++
    }
  }

  // allow enabling & disabling the error tracer at runtime
  // TODO: it would be better to check config in the public add() to prevents collecting
  // errors on the transaction unnecessarily
  if (
    !this.config.collect_errors ||
    !this.config.error_collector ||
    !this.config.error_collector.enabled
  ) {
    return
  }

  if (exception) {
    logger.trace(exception, 'Got exception to trace:')
  }

  var error = createError(transaction, exception, customAttributes, this.config)

  if (this.errors.length < MAX_ERRORS) {
    logger.debug({error: error}, 'Error to be sent to collector:')
    this.errors.push(error)
  } else {
    logger.debug('Already have %d errors to send to collector, not keeping.', MAX_ERRORS)
  }

  // add error event
  if (this.config.error_collector.capture_events === true) {
    var priority = transaction && transaction.priority || Math.random()
    this.events.add(createEvent(transaction, error, timestamp, this.config), priority)
  }
  return true
}

/**
 * Returns collected errors.
 */
ErrorAggregator.prototype.getErrors = function getErrors() {
  return this.errors
}

/**
 * Returns error events based on seen errors.
 */
ErrorAggregator.prototype.getEvents = function getEvents() {
  return this.events.toArray()
}

/**
 * Returns error events object.
 */
ErrorAggregator.prototype.getRawEvents = function getRawEvents() {
  return this.events.getRawEvents()
}

/**
 * Returns maximum number of events that are collected per a harvest cycle.
 */
ErrorAggregator.prototype.getEventsLimit = function getEventsLimit() {
  return this.events.limit
}

/**
 * Returns number of events that have been seen since the last harvest cycle.
 */
ErrorAggregator.prototype.getEventsSeen = function getEventsSeen() {
  return this.events.seen
}

/**
 * Returns total number of collected errors.
 */
ErrorAggregator.prototype.getTotalErrorCount = function getTotalErrorCount() {
  return this.errorCount
}

/**
 * Returns total number of errors collected during web transactions.
 */
ErrorAggregator.prototype.getWebTransactionsErrorCount =
    function getWebTransactionsErrorCount() {
  return this.webTransactionErrorCount
}

/**
 * Returns total number of errors collected during background transactions.
 */
ErrorAggregator.prototype.getBackgroundTransactionsErrorCount =
    function getOtherTransactionsErrorCount() {
  return this.otherTransactionErrorCount
}

/**
 * If the connection to the collector fails, retain as many as will fit without
 * overflowing the current error list.
 *
 * @param array errors Previously harvested errors.
 */
ErrorAggregator.prototype.merge = function merge(errors) {
  if (!errors) return

  var len = Math.min(errors.length, MAX_ERRORS - this.errors.length)
  logger.warn('Merging %s (of %s) errors for next delivery.', len, errors.length)
  for (var i = 0; i < len; i++) {
    this.errors.push(errors[i])
  }
}

ErrorAggregator.prototype.mergeEvents = function mergeEvents(events) {
  this.events.merge(events)
}

ErrorAggregator.prototype.clearEvents = function clearEvents() {
  this.events = new PriorityQueue(this.config.error_collector.max_event_samples_stored)
}

ErrorAggregator.prototype.clearErrors = function clearErrors() {
  this.errors = []
  this.seenStringsByTransaction = Object.create(null)
  this.seenObjectsByTransaction = Object.create(null)
  this.errorCount = 0
  this.webTransactionErrorCount = 0
  this.otherTransactionErrorCount = 0
}

ErrorAggregator.prototype.reconfigure = function reconfigure(config) {
  this.config = config
  this.events.setLimit(this.config.error_collector.max_event_samples_stored)
}
