'use strict';

var path          = require('path')
  , Transaction   = require(path.join(__dirname, '..', 'transaction'))
  ;

/**
 * A single transaction manager per process, hence the need to scope the
 * transactions to an agent or application
 */
var transactions = {};

/**
 * Bundle together the exposed API for transactions.
 */
/**
 * FIXME: replace application concept with agent
 * FIXME: replace application.name with agent.config.app_name
 */
var transactionManager = {
  /**
   * Create a new transaction.
   *
   * @param {Object} application Presumably either the agent, or one
   *                             application defined on an agent.
   * @returns {Transaction} Ready-to-use transaction (with its own (currently
   *                        unused) timer).
   */
  create : function (application) {
    var blank = new Transaction(application);

    if (!transactions[application.name]) transactions[application.name] = [];
    transactions[application.name].push(blank);

    return blank;
  },

  /**
   * Used for testing. Nuke the internal transaction list.
   */
  reset : function () {
    Object.keys(transactions).forEach(function (key) {
      transactions[key].forEach(function (transaction, index) { transaction.end(); });
    });
    transactions = {};
  },

  /**
   * Fetch the list of transactions scoped to the application.
   *
   * @param {Object} application Presumably either the agent, or one
   *                             application defined on an agent.
   * @returns {Array} List of transactions associated with an application.
   */
  getByApplication : function (application) {
    return transactions[application.name];
  },

  /**
   * Fetch the list of active transactions scoped to the application. Useful
   * for debugging, probably not so useful for production use.
   *
   * @param {Object} application Presumably either the agent, or one
   *                             application defined on an agent.
   * @returns {Array} List of active transactions associated with an application.
   */
  getActiveByApplication : function (application) {
    return transactions[application.name].filter(function (transaction) {
      return transaction.isActive();
    });
  }
};

module.exports = transactionManager;
