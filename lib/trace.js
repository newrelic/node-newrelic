'use strict';

var path         = require('path')
  , Timer        = require(path.join(__dirname, 'trace-legacy', 'timer'))
  , Tracer       = require(path.join(__dirname, 'trace-legacy', 'tracer'))
  , Transaction  = require(path.join(__dirname, 'trace-legacy', 'transaction'))
  , Transactions = require(path.join(__dirname, 'trace-legacy', 'transactions'))
  , logger       = require(path.join(__dirname, 'logger'))
  ;

var transactions = new Transactions();

var noopTracer = {
  finish : function () {},
  appendToStack : function () {},
  dummy : true
};


exports.Timer = Timer;
exports.Tracer = Tracer;

exports.createTransaction = function (agent) {
  return new Transaction(agent, transactions);
};

exports.createTracer = function (agent, metricNameOrCallback) {
  var tx = agent.getTransaction();
  return tx ? new Tracer(tx, metricNameOrCallback) : noopTracer;
};

exports.addTransactionListener = function (obj, callback) {
  transactions.on('transactionFinished', function () {
    callback.apply(obj, arguments);
  });
};

exports.setTransactions = function (_transactions) {
  logger.debug('[TESTING] manually injecting transactions');
  transactions = _transactions;
};

exports.resetTransactions = function () {
  logger.debug('[TESTING] resetting watched transaction list');
  transactions = new Transactions();
};
