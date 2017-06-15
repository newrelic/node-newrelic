'use strict'
var logger = require('../logger').child({component: 'transactionHandle'})
module.exports = TransactionHandle
module.exports.stub = {
  end: function endNoTransaction() {
    logger.debug("No transaction found when calling Transaction.end")
  },
  ignore: function ignoreNoTransaction() {
    logger.debug("No transaction found when calling Transaction.ignore")
  }
}

function TransactionHandle(transaction) {
  this._transaction = transaction
}

TransactionHandle.prototype.end = function handleEnd() {
  if (!this._transaction.name) {
    this._transaction.finalizeName(null) // Use existing partial name.
  }
  if (this._transaction.baseSegment) {
    this._transaction.baseSegment.touch()
  }
  this._transaction.end()
}

TransactionHandle.prototype.ignore = function handleIgnore() {
  this._transaction.setForceIgnore(true)
}
