'use strict'
module.exports = TransactionHandle
function TransactionHandle(transaction) {
  this._transaction = transaction
}

TransactionHandle.prototype.end = function handleEnd() {
  this._transaction.end()
}

TransactionHandle.prototype.ignore = function handleIgnore() {
  this._transaction.setForceIgnore(true)
}
