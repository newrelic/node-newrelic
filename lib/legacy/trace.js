'use strict';

var path         = require('path')
  , logger       = require(path.join(__dirname, '..', 'logger'))
  , Tracer       = require(path.join(__dirname, 'tracer'))
  , Transaction  = require(path.join(__dirname, 'transaction'))
  , Transactions = require(path.join(__dirname, 'transactions'))
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
    logger.verbose('[TESTING] manually injecting transactions');
    transactions = _transactions;
  },

  resetTransactions : function () {
    logger.verbose('[TESTING] resetting watched transaction list');
    transactions = new Transactions();
  }
};
