'use strict'
var logger = require('../logger').child({component: 'transactionHandle'})
var DistributedTracePayloadStub = require('./dt-payload').Stub

module.exports = class TransactionHandle {
  /**
  * A light representation of a transaction instance, returned by calling
  * {@link API#getTransaction}.
  *
  * @constructor
  */
  constructor(transaction) {
    this._transaction = transaction
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

  /**
   * Proxy method for Transaction#getTraceId
   */
  getTraceId() {
    if (!this._transaction.agent.config.distributed_tracing.enabled) {
      return ''
    }
    return this._transaction.getTraceId()
  }

  /**
   * Proxy method for Transaction#getSpanId
   */
  getSpanId() {
    if (this._transaction.agent.config.distributed_tracing.enabled &&
      this._transaction.agent.config.span_events.enabled) {
      return this._transaction.getSpanId() || ''
    }

    return ''
  }
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

  getTraceId() {
    logger.debug("No transaction found when calling Transaction.getTraceId")
    return ''
  }

  getSpanId() {
    logger.debug("No transaction found when calling Transaction.getSpanId")
    return ''
  }
}
