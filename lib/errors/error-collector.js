'use strict'

const errorsModule = require('./index')

const logger = require('../logger').child({component: 'error_tracer'})
const urltils = require('../util/urltils')
const errorHelper = require('./helper')
const createError = errorsModule.createError
const createEvent = errorsModule.createEvent

const NAMES = require('../metrics/names')

/**
 * ErrorCollector is responsible for collecting JS errors and errored-out HTTP
 * transactions, and for converting them to error traces and error events expected
 * by the collector.
 *
 * @private
 * @class
 */
class ErrorCollector {
  constructor(config, traceAggregator, eventAggregator, metrics) {
    this.config = config
    this.traceAggregator = traceAggregator
    this.eventAggregator = eventAggregator
    this.metrics = metrics

    this.seenObjectsByTransaction = Object.create(null)
    this.seenStringsByTransaction = Object.create(null)

    this.traceAggregator.on(
      'starting error_data data send.',
      this._onSendErrorTrace.bind(this)
    )
  }

  _onSendErrorTrace() {
    // Clear dupe checking each time error traces attempt to send.
    this._clearSeenErrors()
  }

  start() {
    // TODO: Log? Return true/false?

    const errorCollectorEnabled =
      this.config.error_collector && this.config.error_collector.enabled

    if (!errorCollectorEnabled) {
      return
    }

    if (errorCollectorEnabled && this.config.collect_errors) {
      this.traceAggregator.start()
    }

    if (this.config.error_collector.capture_events) {
      this.eventAggregator.start()
    }
  }

  stop() {
    this.traceAggregator.stop()
    this.eventAggregator.stop()
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
  _haveSeen(transaction, exception) {
    const txId = transaction ? transaction.id : 'Unknown'

    if (typeof exception === 'object') {
      if (!this.seenObjectsByTransaction[txId]) {
        this.seenObjectsByTransaction[txId] = new WeakSet()
      }

      var seenObjects = this.seenObjectsByTransaction[txId]
      if (seenObjects.has(exception)) {
        return true
      }

      // TODO: Refactor usage of `_haveSeen` so that we don't have the side effect
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
   * Every finished transaction goes through this handler, so do as little as
   * possible.
   *
   * @param {Transaction} transaction
   *
   * @return {number} The number of unexpected errors
   */
  onTransactionFinished(transaction) {
    if (!transaction) throw new Error('Error collector got a blank transaction.')
    if (transaction.ignore) {
      return
    }

    // TODO: Prob shouldn't do any work if errors fully disabled.

    // collect user errors even if status code is ignored
    let collectedErrors = 0
    let expectedErrors = 0

    // errors from noticeError are currently exempt from
    // ignore and exclude rules
    if (transaction.userErrors.length) {
      for (let i = 0; i < transaction.userErrors.length; i++) {
        const exception = transaction.userErrors[i]
        if (this._collect(transaction, exception[0], exception[1], exception[2])) {
          ++collectedErrors
        }
      }
    }

    const isErroredTransaction = urltils.isError(this.config, transaction.statusCode)
    const isExpectedErrorStatusCode = urltils.isExpectedError(
      this.config,
      transaction.statusCode
    )

    // collect other exceptions only if status code is not ignored
    if (transaction.exceptions.length) {
      for (let i = 0; i < transaction.exceptions.length; i++) {
        const exception = transaction.exceptions[i]
        if (this.collect(transaction, exception[0], exception[1], exception[2])) {
          ++collectedErrors
          // if we could collect it, then check if expected
          if (isExpectedErrorStatusCode ||
            errorHelper.isExpectedException(
              transaction,
              exception[0],
              this.config,
              urltils
            )
          ) {
            ++expectedErrors
          }
        }
      }
    } else if (isErroredTransaction && this.collect(transaction)) {
      ++collectedErrors
      if (isExpectedErrorStatusCode) {
        ++expectedErrors
      }
    }

    const unexpectedErrors = collectedErrors - expectedErrors

    // the metric should be incremented only if the error was not expected
    if (unexpectedErrors > 0) {
      this.metrics
        .getOrCreateMetric(NAMES.ERRORS.PREFIX + transaction.getFullName())
        .incrementCallCount(unexpectedErrors)
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
    if (!exception) {
      return
    }

    const timestamp = Date.now()

    if (transaction) {
      transaction.addException(exception, customAttributes, timestamp)
    } else {
      this.collect(transaction, exception, customAttributes, timestamp)
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
   * Wrapper for _collect, include logic for whether an error should
   * be ignored or not.  Exists to allow userErrors to bypass ignore
   * logic.
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
  collect(transaction, exception, customAttributes, timestamp) {
    if (errorHelper.shouldIgnoreError(transaction, exception, this.config)) {
      logger.trace("Ignoring error")
      return
    }
    return this._collect(transaction, exception, customAttributes, timestamp)
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
      if (this._haveSeen(transaction, exception)) {
        return false
      }

      if (typeof exception !== 'string' && !exception.message && !exception.stack) {
        logger.trace(exception, 'Got error that is not an instance of Error or string.')
        exception = null
      }
    }

    if (!exception && (!transaction || !transaction.statusCode || transaction.error)) {
      return false
    }

    // allow enabling & disabling the error tracer at runtime
    // TODO: it would be better to check config in the public add() to prevents collecting
    // errors on the transaction unnecessarily. Should we allow the work above or
    // short-circuit sooner?
    if (
      !this.config.collect_errors ||
      !this.config.error_collector ||
      !this.config.error_collector.enabled
    ) {
      return false
    }

    if (exception) {
      logger.trace(exception, 'Got exception to trace:')
    }

    const error = createError(transaction, exception, customAttributes, this.config)

    const isExpectedError = true === error[4].intrinsics['error.expected']

    if (isExpectedError) {
      this.metrics.getOrCreateMetric(NAMES.ERRORS.EXPECTED).incrementCallCount()
    } else {
      this.metrics.getOrCreateMetric(NAMES.ERRORS.ALL).incrementCallCount()

      if (transaction) {
        if (transaction.isWeb()) {
          this.metrics.getOrCreateMetric(NAMES.ERRORS.WEB).incrementCallCount()
        } else {
          this.metrics.getOrCreateMetric(NAMES.ERRORS.OTHER).incrementCallCount()
        }
      }
    }

    this.traceAggregator.add(error)

    if (this.config.error_collector.capture_events === true) {
      const priority = transaction && transaction.priority || Math.random()
      const event = createEvent(transaction, error, timestamp, this.config)
      this.eventAggregator.add(event, priority)
    }

    return true
  }

  // TODO: ideally, this becomes unnecessary
  clearAll() {
    this.traceAggregator.clear()
    this.eventAggregator.clear()

    this._clearSeenErrors()
  }

  _clearSeenErrors() {
    this.seenStringsByTransaction = Object.create(null)
    this.seenObjectsByTransaction = Object.create(null)
  }

  reconfigure(config) {
    this.config = config

    this.traceAggregator.reconfigure(config)
    this.eventAggregator.reconfigure(config)

    const errorCollectorEnabled =
      this.config.error_collector && this.config.error_collector.enabled

    if (!errorCollectorEnabled) {
      this.stop()
      return
    }

    if (this.config.collect_errors === false) {
      this.traceAggregator.stop()
    }

    if (this.config.error_collector.capture_events === false) {
      this.eventAggregator.stop()
    }
  }
}

module.exports = ErrorCollector
