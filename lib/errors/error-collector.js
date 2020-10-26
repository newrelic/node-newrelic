/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const errorsModule = require('./index')

const logger = require('../logger').child({component: 'error_tracer'})
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
        if (this.collect(transaction, exception)) {
          ++collectedErrors
        }
      }
    }

    const isErroredTransaction = urltils.isError(this.config, transaction.statusCode)
    const isIgnoredErrorStatusCode = urltils.isIgnoredError(
      this.config,
      transaction.statusCode
    )

    const isExpectedErrorStatusCode = urltils.isExpectedError(
      this.config,
      transaction.statusCode
    )

    // collect other exceptions only if status code is not ignored
    if (transaction.exceptions.length && !isIgnoredErrorStatusCode) {
      for (let i = 0; i < transaction.exceptions.length; i++) {
        const exception = transaction.exceptions[i]
        if (this.collect(transaction, exception)) {
          ++collectedErrors
          // if we could collect it, then check if expected
          if (isExpectedErrorStatusCode ||
            errorHelper.isExpectedException(
              transaction,
              exception.error,
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
    const exception = new Exception({error, timestamp, customAttributes})

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
   * @param {Exception}  exception The Exception to be traced.
   */
  addUserError(transaction, error, customAttributes) {
    if (!error) {
      return
    }

    const shouldCollectErrors = this._shouldCollectErrors()
    if (!shouldCollectErrors) {
      logger.trace('error_collector.enabled is false, dropping user reported error.')
      return
    }

    const timestamp = Date.now()
    const exception = new Exception({error, timestamp, customAttributes})

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
   * @return  {bool}  True if the error was collected.
   */
  collect(transaction, exception) {
    if (!exception) {
      exception = new Exception({})
    }

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
    }

    const errorTrace = createError(transaction, exception, this.config)

    const isExpectedError = true === errorTrace[4].intrinsics['error.expected']

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

    // defaults true in config/index. can be modified server-side
    if (this.config.collect_errors) {
      this.traceAggregator.add(errorTrace)
    }

    if (this.config.error_collector.capture_events === true) {
      const priority = transaction && transaction.priority || Math.random()
      const event = createEvent(transaction, errorTrace, exception.timestamp, this.config)
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

  _shouldCollectErrors() {
    const errorCollectorEnabled =
      this.config.error_collector && this.config.error_collector.enabled

    const shouldCaptureTraceOrEvent =
      this.config.collect_errors || // are traces enabled
      (this.config.error_collector && this.config.error_collector.capture_events)

    return errorCollectorEnabled && shouldCaptureTraceOrEvent
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
