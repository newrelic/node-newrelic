/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'transactionHandle' })

const NAMES = require('../../lib/metrics/names')

class TransactionHandle {
  /**
   * A light representation of a transaction instance, returned by calling
   * {@link API#getTransaction}.
   *
   * @param transaction
   * @param metrics
   * @class
   */
  constructor(transaction, metrics) {
    this._transaction = transaction
    this._metrics = metrics
  }

  /**
   * End the transaction.
   *
   * @param  {Function} callback
   */
  end(callback) {
    const tx = this._transaction.end()
    if (typeof callback === 'function') {
      // XXX: Since Transaction#end is now synchronous, this needs to
      // asynchronously call the callback like Transaction#end used to.
      // Change this to be synchronous in the next major version.
      setImmediate(callback, tx)
    }
  }

  /**
   * Mark the transaction to be ignored.
   */
  ignore() {
    this._transaction.setForceIgnore(true)
  }

  /**
   * Return whether this Transaction is being sampled
   */
  isSampled() {
    return this._transaction.isSampled()
  }

  /**
   * Parsing incoming headers for use in a distributed trace.
   * W3C TraceContext format is preferred over the NewRelic DT format.
   * NewRelic DT format will be used if no `traceparent` header is found.
   *
   * @param @param {string} [transportType='Unknown'] - The transport type that delivered the trace.
   * @param transportType
   * @param {object} headers - Headers to search for supported formats. Keys must be lowercase.
   */
  acceptDistributedTraceHeaders(transportType, headers) {
    incrementApiSupportMetric(this._metrics, 'acceptDistributedTraceHeaders')
    return this._transaction.acceptDistributedTraceHeaders(transportType, headers)
  }

  /**
   * Inserts distributed trace headers into the provided headers map.
   *
   * @param {object} headers
   */
  insertDistributedTraceHeaders(headers) {
    incrementApiSupportMetric(this._metrics, 'insertDistributedTraceHeaders')
    return this._transaction.insertDistributedTraceHeaders(headers)
  }
}

module.exports = TransactionHandle

/**
 *
 * @param metrics
 * @param functionName
 */
function incrementApiSupportMetric(metrics, functionName) {
  if (!metrics) {
    logger.warnOnce(
      'Cannot add TransactionHandle API support metric. The metrics collection is missing.'
    )
    return
  }

  const metric = metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.TRANSACTION_API + '/' + functionName
  )

  metric.incrementCallCount()
  return metric
}

module.exports.Stub = class TransactionHandleStub {
  end(callback) {
    if (callback instanceof Function) {
      setImmediate(callback)
    }
    logger.debug('No transaction found when calling Transaction.end')
  }

  ignore() {
    logger.debug('No transaction found when calling Transaction.ignore')
  }

  isSampled() {
    logger.debug('No transaction found when calling Transaction.isSampled')
  }

  acceptDistributedTraceHeaders() {
    logger.debug('No transaction found when calling Transaction.acceptDistributedTraceHeaders')
  }

  insertDistributedTraceHeaders() {
    logger.debug('No transaction found when calling Transaction.insertDistributedTraceHeaders')
  }
}
