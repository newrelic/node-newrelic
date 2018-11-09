'use strict'

const errorsModule = require('./index')
const EventAggregator = require('../event-aggregator')
const logger = require('../logger').child({component: 'error_tracer'})
const NAMES = require('../metrics/names')
const urltils = require('../util/urltils')

const createError = errorsModule.createError
const createEvent = errorsModule.createEvent

/*
 *
 * CONSTANTS
 *
 */
const MAX_ERRORS = 20
const SERVERLESS_SAMPLING_LIMIT = Infinity

/**
 * ErrorAggregator is responsible for collecting JS errors and errored-out HTTP
 * transactions, and for converting them to error traces and error events expected
 * by the collector.
 *
 * @private
 * @class
 */
class ErrorAggregator extends EventAggregator {
  constructor(config) {
    super(
      config.serverless_mode.enabled
        ? SERVERLESS_SAMPLING_LIMIT
        : config.error_collector.max_event_samples_stored
    )

    this.config = config
    this.errorCount = 0
    this.webTransactionErrorCount = 0
    this.otherTransactionErrorCount = 0
    this.errors = []
    this.seenObjectsByTransaction = Object.create(null)
    this.seenStringsByTransaction = Object.create(null)
  }

  /**
   * Every finished transaction goes through this handler, so do as little as
   * possible.
   *
   * @param {Transaction} transaction
   * @param {Metrics} metrics
   */
  onTransactionFinished(transaction, metrics) {
    if (!transaction) throw new Error('Error collector got a blank transaction.')
    if (!metrics) throw new Error('Error collector requires metrics to count errors.')
    if (transaction.ignore) {
      return
    }

    // collect user errors even if status code is ignored
    let collectedErrors = 0
    if (transaction.userErrors.length) {
      for (let i = 0; i < transaction.userErrors.length; i++) {
        const exception = transaction.userErrors[i]
        if (this._collect(transaction, exception[0], exception[1], exception[2])) {
          ++collectedErrors
        }
      }
    }

    const isErroredTransaction = urltils.isError(this.config, transaction.statusCode)
    const isIgnoredErrorStatusCode = urltils.isIgnoredError(
      this.config,
      transaction.statusCode
    )

    // collect other exceptions only if status code is not ignored
    if (transaction.exceptions.length && !isIgnoredErrorStatusCode) {
      for (let i = 0; i < transaction.exceptions.length; i++) {
        const exception = transaction.exceptions[i]
        if (this._collect(transaction, exception[0], exception[1], exception[2])) {
          ++collectedErrors
        }
      }
    } else if (isErroredTransaction && this._collect(transaction)) {
      ++collectedErrors
    }

    // the metric should be incremented only if the error was actually collected
    if (collectedErrors > 0) {
      metrics.getOrCreateMetric(NAMES.ERRORS.PREFIX + transaction.getFullName())
        .incrementCallCount(collectedErrors)
    }
  }

  /**
   * This function collects the error right away when transaction is not supplied.
   * Otherwise it delays collecting the error until the transaction ends.
   *
   * NOTE: this interface is unofficial and may change in future.
   *
   * @param {?Transaction} transaction
   *  Transaction associated with the error.
   *
   * @param {Error} exception
   *  The error to be traced.
   *
   * @param {object} customAttributes
   *  Any custom attributes associated with the request (optional).
   */
  add(transaction, exception, customAttributes) {
    if (!exception) return

    var timestamp = Date.now()

    if (transaction) {
      transaction.addException(exception, customAttributes, timestamp)
    } else {
      this._collect(transaction, exception, customAttributes, timestamp)
    }
  }

  /**
   * This function is used to collect errors specifically added using the
   * `API#noticeError()` method.
   *
   * Similarly to add(), it collects the error right away when transaction is
   * not supplied. Otherwise it delays collecting the error until the transaction
   * ends. The reason for separating the API errors from other exceptions is that
   * different ignore rules apply to them.
   *
   * NOTE: this interface is unofficial and may change in future.
   *
   * @param {?Transaction} transaction
   *  Transaction associated with the error.
   *
   * @param {Error} exception
   *  The error to be traced.
   *
   * @param {object} [customAttributes=null]
   *  Any custom attributes associated with the request (optional).
   */
  addUserError(transaction, exception, customAttributes) {
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
   * @param {?Transaction}  transaction -
   * @param {Error}         exception   - The error to be checked.
   */
  haveSeen(transaction, exception) {
    const txId = transaction ? transaction.id : 'Unknown'

    if (typeof exception === 'object') {
      if (!this.seenObjectsByTransaction[txId]) {
        this.seenObjectsByTransaction[txId] = new WeakSet()
      }

      var seenObjects = this.seenObjectsByTransaction[txId]
      if (seenObjects.has(exception)) {
        return true
      }

      // TODO: Refactor usage of `haveSeen` so that we don't have the side effect
      // of marking the exception as seen when we're just testing for if we've
      // seen it!
      seenObjects.add(exception)
    } else { // typeof exception !== 'object'
      if (!this.seenStringsByTransaction[txId]) {
        this.seenStringsByTransaction[txId] = Object.create(null)
      }

      var seenStrings = this.seenStringsByTransaction[txId]
      if (seenStrings[exception]) {
        return true
      }

      seenStrings[exception] = true
    }
    return false
  }

  /**
   * Collects the error and also creates the error event.
   *
   * @private
   *
   * This function uses an array of seen exceptions to ensure errors don't get
   * double-counted. It can also be used as an unofficial means of marking that
   * user errors shouldn't be traced.
   *
   * For an error to be traced, at least one of the transaction or the error
   * must be present.
   *
   * NOTE: this interface is unofficial and may change in future.
   *
   * @param {?Transaction} transaction
   *  Transaction associated with the error.
   *
   * @param {?Error} exception
   *  The error to be traced.
   *
   * @param {?object} customAttributes
   *  Any custom attributes associated with the request.
   *
   * @param {number} timestamp
   *
   * @return {bool} True if the error was collected.
   */
  _collect(transaction, exception, customAttributes, timestamp) {
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
      logger.debug(error, 'Error to be sent to collector.')
      this.errors.push(error)
    } else {
      logger.debug(
        'Already have %d errors to send to collector, not keeping.',
        MAX_ERRORS
      )
    }

    // add error event
    if (this.config.error_collector.capture_events === true) {
      var priority = transaction && transaction.priority || Math.random()
      this.addEvent(createEvent(transaction, error, timestamp, this.config), priority)
    }
    return true
  }

  /**
   * Returns collected errors.
   */
  getErrors() {
    return this.errors
  }

  /**
   * Returns total number of collected errors.
   */
  getTotalErrorCount() {
    return this.errorCount
  }

  /**
   * Returns total number of errors collected during web transactions.
   */
  getWebTransactionsErrorCount() {
    return this.webTransactionErrorCount
  }

  /**
   * Returns total number of errors collected during background transactions.
   */
  getOtherTransactionsErrorCount() {
    return this.otherTransactionErrorCount
  }

  /**
   * If the connection to the collector fails, retain as many as will fit without
   * overflowing the current error list.
   *
   * The error counts are not updated on a merge because the counts are _only_
   * for the current harvest cycle.
   *
   * @param {array} errors Previously harvested errors.
   */
  mergeErrors(errors) {
    if (!errors) return

    var len = Math.min(errors.length, MAX_ERRORS - this.errors.length)
    logger.warn('Merging %s (of %s) errors for next delivery.', len, errors.length)
    for (var i = 0; i < len; i++) {
      this.errors.push(errors[i])
    }
  }

  clearErrors() {
    this.errors = []
    this.seenStringsByTransaction = Object.create(null)
    this.seenObjectsByTransaction = Object.create(null)
    this.errorCount = 0
    this.webTransactionErrorCount = 0
    this.otherTransactionErrorCount = 0
  }

  reconfigure(config) {
    this.config = config
    this.limit = config.serverless_mode.enabled
      ? SERVERLESS_SAMPLING_LIMIT
      : config.error_collector.max_event_samples_stored
  }
}

module.exports = ErrorAggregator
