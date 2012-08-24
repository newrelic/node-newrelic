'use strict';

var path          = require('path')
  , Transaction   = require(path.join(__dirname, '..', 'transaction'))
  , callstack     = require(path.join(__dirname, '..', 'util', 'callstack'))
  ;

/**
 * A single transaction manager per process, hence the need to scope the
 * transactions per agent.
 */
var transactions = {};

var getAgentName = function getAgentName(agent) {
    var agentID = '[unconfigured]';
    if (agent.config && agent.config.app_name) agentID = agent.config.app_name;

    return agentID;
};

/**
 * Bundle together the exposed API for transactions.
 */
var manager = {
  NR_TRANSACTION_NAME : '__NR__transaction',

  /**
   * Create a new transaction.
   *
   * @param {Object} agent The agent to which the transaction is bound.
   * @returns {Transaction} Ready-to-use transaction (with its own (currently
   *                        unused) timer).
   */
  create : function (agent) {
    var blank = new Transaction(agent);

    callstack.annotateCaller(manager.NR_TRANSACTION_NAME, blank);

    var agentName = getAgentName(agent);
    if (!transactions[agentName]) transactions[agentName] = [];
    transactions[agentName].push(blank);

    return blank;
  },

  find : function (agent) {
    return callstack.findAnnotation(manager.NR_TRANSACTION_NAME);
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
   * Fetch the list of transactions scoped to the agent.
   *
   * @param {Object} agent The agent.
   * @returns {Array} List of transactions associated with the agent.
   */
  getByApplication : function (agent) {
    return transactions[getAgentName(agent)];
  },

  /**
   * Fetch the list of active transactions scoped to the agent. Useful
   * for debugging, probably not so useful for production use.
   *
   * @param {Object} agent The agent.
   * @returns {Array} List of active transactions associated with the agent.
   */
  getActiveByApplication : function (agent) {
    return transactions[getAgentName(agent)].filter(function (transaction) {
      return transaction.isActive();
    });
  }
};

module.exports = manager;
