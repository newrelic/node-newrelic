'use strict';

var events     = require('events')
  , util       = require('util')
  ;

/**
 * Transactions: collection with event handler
 *
 * FIXME: probably don't need this; replace with bare EventEmitter?
 */
function Transactions() {
  events.EventEmitter.call(this);
}
util.inherits(Transactions, events.EventEmitter);

Transactions.prototype.transactionFinished = function (transaction) {
  this.emit('transactionFinished', transaction);
};

module.exports = Transactions;
