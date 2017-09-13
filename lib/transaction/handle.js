'use strict'
var logger = require('../logger').child({component: 'transactionHandle'})
module.exports = TransactionHandle
module.exports.stub = {
  end: function endNoTransaction(callback) {
    if (callback instanceof Function) {
      setImmediate(callback)
    }
    logger.debug("No transaction found when calling Transaction.end")
  },
  ignore: function ignoreNoTransaction() {
    logger.debug("No transaction found when calling Transaction.ignore")
  }
}

/**
 * A light representation of a transaction instance, returned by calling
 * {@link API#getTransaction}.
 *
 * @constructor
 */
function TransactionHandle(transaction) {
  this._transaction = transaction
}

/**
 * End the transaction.
 *
 * @param  {Function} callback
 */
TransactionHandle.prototype.end = function handleEnd(callback) {
  this._transaction.end(callback)
}

/**
 * Mark the transaction to be ignored.
 */
TransactionHandle.prototype.ignore = function handleIgnore() {
  this._transaction.setForceIgnore(true)
}
