/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')
const logger = require('../logger').child({component: 'transactionHandle'})
const DistributedTracePayloadStub = require('./dt-payload').Stub

const NAMES = require('../../lib/metrics/names')

class TransactionHandle {
  /**
  * A light representation of a transaction instance, returned by calling
  * {@link API#getTransaction}.
  *
  * @constructor
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
   * @param @param {string} [transportType='Unknown'] - The transport type that delivered the trace.
   * @param {object} headers - Headers to search for supported formats. Keys must be lowercase.
   */
  acceptDistributedTraceHeaders(transportType, headers) {
    incrementApiSupportMetric(this._metrics, 'acceptDistributedTraceHeaders')

    return this._transaction.acceptDistributedTraceHeaders(transportType, headers)
  }

  /**
   * Inserts distributed trace headers into the provided headers map.
   * @param {Object} headers
   */
  insertDistributedTraceHeaders(headers) {
    incrementApiSupportMetric(this._metrics, 'insertDistributedTraceHeaders')

    return this._transaction.insertDistributedTraceHeaders(headers)
  }

  /**
  *
  * Proxy method for Transaction#createDistrubtedTracePayload.
  *
  * @returns {DistributedTracePayload} The created payload object.
  *
  */
  createDistributedTracePayload() {
    return this._transaction.createDistributedTracePayload()
  }

  /**
  *
  * Proxy method for Transaction#acceptDistributedTracePayload
  *
  * @param {String} The payload to accept as the parent to the current trace
  *
  */
  acceptDistributedTracePayload(payload) {
    return this._transaction.acceptDistributedTracePayload(payload)
  }
}

// TODO: Fully remove functions in future Major release. v7.0.0?
TransactionHandle.prototype.acceptDistributedTracePayload = util.deprecate(
  TransactionHandle.prototype.acceptDistributedTracePayload,
  'TransactionHandle#acceptDistributedTracePayload has been deprecated! ' +
  'Please use TransactionHandle#acceptDistributedTraceHeaders ' +
  'which supports multiple distributed trace formats.'
)

TransactionHandle.prototype.createDistributedTracePayload = util.deprecate(
  TransactionHandle.prototype.createDistributedTracePayload,
  'TransactionHandle#createDistributedTracePayload has been deprecated! ' +
  'Please use TransactionHandle#insertDistributedTraceHeaders ' +
  'which supports multiple distributed trace formats.'
)

module.exports = TransactionHandle

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
    logger.debug("No transaction found when calling Transaction.end")
  }

  ignore() {
    logger.debug("No transaction found when calling Transaction.ignore")
  }

  isSampled() {
    logger.debug("No transaction found when calling Transaction.isSampled")
  }

  createDistributedTracePayload() {
    logger.debug(
      "No transaction found when calling Transaction.createDistributedTracePayload"
    )
    return new DistributedTracePayloadStub()
  }

  acceptDistributedTracePayload() {
    logger.debug(
      "No transaction found when calling Transaction.acceptDistributedTracePayload"
    )
  }

  acceptDistributedTraceHeaders() {
    logger.debug("No transaction found when calling Transaction.acceptDistributedTraceHeaders")
  }

  insertDistributedTraceHeaders() {
    logger.debug("No transaction found when calling Transaction.insertDistributedTraceHeaders")
  }
}
