'use strict';

var path         = require('path')
  , Tracer       = require(path.join(__dirname, 'legacy', 'tracer'))
  , Transaction  = require(path.join(__dirname, 'legacy', 'transaction'))
  , Transactions = require(path.join(__dirname, 'legacy', 'transactions'))
  , logger       = require(path.join(__dirname, 'logger'))
  ;

var transactions = new Transactions();

var noopTracer = {
  finish : function () {},
  appendToStack : function () {},
  dummy : true
};

module.exports = {
  createTransaction : function (agent) {
    return new Transaction(agent, transactions);
  },

  createTracer : function (agent, metricNameOrCallback) {
    var tx = agent.getTransaction();
    return tx ? new Tracer(tx, metricNameOrCallback) : noopTracer;
  },

  addTransactionListener : function (obj, callback) {
    transactions.on('transactionFinished', function () {
      callback.apply(obj, arguments);
    });
  },

  setTransactions : function (_transactions) {
    logger.debug('[TESTING] manually injecting transactions');
    transactions = _transactions;
  },

  resetTransactions : function () {
    logger.debug('[TESTING] resetting watched transaction list');
    transactions = new Transactions();
  }
};
