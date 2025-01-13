/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const errorsModule = require('./index')

const logger = require('../logger').child({ component: 'error_tracer' })
const urltils = require('../util/urltils')
const Exception = require('../errors').Exception
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

    this.traceAggregator.on('starting_data_send-error_data', this._onSendErrorTrace.bind(this))

    this.errorGroupCallback = null
  }

  _onSendErrorTrace() {
    // Clear dupe checking each time error traces attempt to send.
    this._clearSeenErrors()
  }

  /**
   *
   * This function takes an exception and determines whether the exception
   * has been seen before by this aggregator.  This function mutates the
   * book keeping structures to reflect the exception has been seen.
   *
   * @param {?Transaction}  transaction -
   * @param {Error}         exception   - The error to be checked.
   * @returns {boolean} whether or not the exception has already been tracked
   */
  _haveSeen(transaction, exception) {
    const txId = transaction ? transaction.id : 'Unknown'

    if (typeof exception === 'object') {
      if (!this.seenObjectsByTransaction[txId]) {
        this.seenObjectsByTransaction[txId] = new WeakSet()
      }

      const seenObjects = this.seenObjectsByTransaction[txId]
      if (seenObjects.has(exception)) {
        return true
      }

      // TODO: Refactor usage of `_haveSeen` so that we don't have the side effect
      // of marking the exception as seen when we're just testing for if we've
      // seen it!
      seenObjects.add(exception)
    } else {
      // typeof exception !== 'object'
      if (!this.seenStringsByTransaction[txId]) {
        this.seenStringsByTransaction[txId] = Object.create(null)
      }

      const seenStrings = this.seenStringsByTransaction[txId]
      if (seenStrings[exception]) {
        return true
      }

      seenStrings[exception] = true
    }
    return false
  }

  /**
   * Gets the iterable property from the transaction based on the error type
   *
   * @param {Transaction} transaction the collected exception's transaction
   * @param {string} errorType the type of error: "user", "transactionException", "transaction"
   * @returns {object[]} the iterable property from the transaction based on the error type
   */
  _getIterableProperty(transaction, errorType) {
    let iterableProperty = null
    if (errorType === 'user') {
      iterableProperty = transaction.userErrors
    }
    if (errorType === 'transactionException') {
      iterableProperty = transaction.exceptions
    }
    return iterableProperty
  }

  /**
   * Helper method for processing errors that are created with .noticeError(), exceptions
   * on the transaction (transaction.exceptions array), and inferred errors based on Transaction metadata.
   *
   * @param {Transaction} transaction the collected exception's transaction
   * @param {number} collectedErrors the number of errors we've successfully .collect()-ed
   * @param {number} expectedErrors the number of errors marked as expected in noticeError
   * @param {string} errorType the type of error to be processed; "user", "transactionException", "transaction"
   * @returns {Array.<number>} the updated [collectedErrors, expectedErrors] numbers post processing
   */
  _processErrors(transaction, collectedErrors, expectedErrors, errorType) {
    const iterableProperty = this._getIterableProperty(transaction, errorType)
    if (iterableProperty === null && errorType === 'transaction') {
      if (this.collect(transaction)) {
        collectedErrors++
        if (urltils.isExpectedError(this.config, transaction.statusCode)) {
          expectedErrors++
        }
      }
      return [collectedErrors, expectedErrors]
    }

    if (iterableProperty === null) {
      return [collectedErrors, expectedErrors]
    }

    for (let i = 0; i < iterableProperty.length; i++) {
      const exception = iterableProperty[i]
      if (!this.collect(transaction, exception)) {
        continue
      }
      collectedErrors++
      if (
        urltils.isExpectedError(this.config, transaction.statusCode) ||
        errorHelper.isExpectedException(transaction, exception, this.config, urltils)
      ) {
        expectedErrors++
      }
    }
    return [collectedErrors, expectedErrors]
  }

  /**
   * Every finished transaction goes through this handler, so do as little as
   * possible.
   *
   * TODO: Prob shouldn't do any work if errors fully disabled.
   *
   * @param {Transaction} transaction the completed transaction
   */
  onTransactionFinished(transaction) {
    if (!transaction) {
      throw new Error('Error collector got a blank transaction.')
    }
    if (transaction.ignore) {
      return
    }

    // collect user errors even if status code is ignored
    let collectedErrors = 0
    let expectedErrors = 0

    // errors from noticeError are currently exempt from
    // ignore and exclude rules
    ;[collectedErrors, expectedErrors] = this._processErrors(
      transaction,
      collectedErrors,
      expectedErrors,
      'user'
    )

    const isErroredTransaction = urltils.isError(this.config, transaction.statusCode)
    const isIgnoredErrorStatusCode = urltils.isIgnoredError(this.config, transaction.statusCode)

    // collect other exceptions only if status code is not ignored
    if (transaction.exceptions.length && !isIgnoredErrorStatusCode) {
      ;[collectedErrors, expectedErrors] = this._processErrors(
        transaction,
        collectedErrors,
        expectedErrors,
        'transactionException'
      )
    } else if (isErroredTransaction) {
      ;[collectedErrors, expectedErrors] = this._processErrors(
        transaction,
        collectedErrors,
        expectedErrors,
        'transaction'
      )
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
   * This function collects the error right away when transaction is not supplied. Otherwise it
   * delays collecting the error until the transaction ends.
   *
   * NOTE: this interface is unofficial and may change in future.
   *
   * @param {?Transaction}  transaction  Transaction associated with the error.
   * @param {Error}  error  The error to be traced.
   * @param {?object}  customAttributes  Custom attributes associated with the request (optional).
   */
  add(transaction, error, customAttributes) {
    if (!error) {
      return
    }

    const shouldCollectErrors = this._shouldCollectErrors()
    if (!shouldCollectErrors) {
      logger.trace('error_collector.enabled is false, dropping application error.')
      return
    }

    if (errorHelper.shouldIgnoreError(transaction, error, this.config)) {
      logger.trace('Ignoring error')
      return
    }

    const timestamp = Date.now()
    const exception = new Exception({ error, timestamp, customAttributes })

    if (transaction) {
      transaction.addException(exception)
    } else {
      this.collect(transaction, exception)
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
   * @param {?Transaction}  transaction  Transaction associated with the error.
   * @param {*} error The error passed into `API#noticeError()`
   * @param {object} customAttributes custom attributes to add to the error
   * @param {boolean} expected Is the error expected?
   */
  addUserError(transaction, error, customAttributes, expected) {
    if (!error) {
      return
    }

    const shouldCollectErrors = this._shouldCollectErrors()
    if (!shouldCollectErrors) {
      logger.trace('error_collector.enabled is false, dropping user reported error.')
      return
    }

    const timestamp = Date.now()
    const exception = new Exception({ error, timestamp, customAttributes, expected })

    if (transaction) {
      transaction.addUserError(exception)
    } else {
      this.collect(transaction, exception)
    }
  }

  /**
   * Collects the error and also creates the error event.
   *
   * This function uses an array of seen exceptions to ensure errors don't get double-counted. It
   * can also be used as an unofficial means of marking that user errors shouldn't be traced.
   *
   * For an error to be traced, at least one of the transaction or the error must be present.
   *
   * NOTE: this interface is unofficial and may change in future.
   *
   * @param  {?Transaction}  transaction  Transaction associated with the error.
   * @param  {?Exception}  exception  The Exception object to be traced.
   * @returns  {boolean}  True if the error was collected.
   */
  collect(transaction, exception = new Exception({})) {
    if (!this._isValidException(exception, transaction)) {
      return false
    }

    if (this.errorGroupCallback) {
      exception.errorGroupCallback = this.errorGroupCallback
    }

    const errorTrace = createError(transaction, exception, this.config)
    this._maybeRecordErrorMetrics(errorTrace, transaction)

    // defaults true in config/index. can be modified server-side
    if (this.config.collect_errors) {
      this.traceAggregator.add(errorTrace)
    }

    if (this.config.error_collector.capture_events === true) {
      // eslint-disable-next-line sonarjs/pseudo-random
      const priority = (transaction && transaction.priority) || Math.random()
      const event = createEvent(transaction, errorTrace, exception.timestamp, this.config)
      this.eventAggregator.add(event, priority)
    }

    return true
  }

  /**
   * Helper method for ensuring that a collected exception/transaction combination can be collected
   *
   * @param {object} exception the exception to validate
   * @param {Transaction} transaction the Transaction to validate, if exception is malformed we'll try to fallback to transaction data
   * @returns {boolean} whether or not the exception/transaction combo has everything needed for processing
   */
  _isValidException(exception, transaction) {
    if (exception.error) {
      if (this._haveSeen(transaction, exception.error)) {
        return false
      }

      const error = exception.error
      if (typeof error !== 'string' && !error.message && !error.stack) {
        logger.trace(error, 'Got error that is not an instance of Error or string.')
        exception.error = null
      }
    }

    if (!exception.error && (!transaction || !transaction.statusCode || transaction.error)) {
      return false
    }

    if (exception.error) {
      logger.trace(exception.error, 'Got exception to trace:')
    } else {
      logger.trace(transaction, 'Got transaction error to trace:')
    }

    return true
  }

  /**
   * Helper method for recording metrics about errors depending on the type of error that happened
   *
   * @param {Array} errorTrace list of error information
   * @param {Transaction} transaction the transaction associated with the trace
   */
  _maybeRecordErrorMetrics(errorTrace, transaction) {
    const isExpectedError = errorTrace[4].intrinsics['error.expected'] === true

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

  _shouldCollectErrors() {
    const errorCollectorEnabled = this.config.error_collector && this.config.error_collector.enabled

    const shouldCaptureTraceOrEvent =
      this.config.collect_errors || // are traces enabled
      (this.config.error_collector && this.config.error_collector.capture_events)

    return errorCollectorEnabled && shouldCaptureTraceOrEvent
  }
}

module.exports = ErrorCollector
