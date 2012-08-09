'use strict';

var path = require('path')
  , logger = require(path.join(__dirname, 'logger'))
  ;

var agents = [];

var generateShim = function (next, name) {
  var transaction;

  agents.forEach(function (agent, i) {
    transaction = agent.getTransaction();

    if (transaction && transaction.finished) {
      agent.clearTransaction(transaction);
      transaction = null;
    }
  });

  return function () {
    // FIXME: transactions should be scoped to an agent
    agents.forEach(function (agent, i) {
      agent.setTransaction(transaction);
    });

    return next.apply(this, arguments);
  };
};

// Thanks Adam Crabtree! (dude@noderiety.com)
// taken from https://github.com/CrabDude/trycatch
require(path.join(__dirname, 'hook'))(generateShim);

exports.wrapAgent = function (agent) {
  logger.debug('wrapping agent with shim');
  agents.push(agent);
};

exports.unwrapAgent = function (agent) {
  logger.debug('unwrapping agent from shim');
  agents = agents.filter(function (item) { return item !== agent; });
};

exports.preserveMethod = function (nodule, method) {
  var wrapped = '__NR_ORIG_' + method;
  if (!nodule[wrapped]) {
    logger.debug('preserving ' + method + ' as ' + wrapped);
    nodule[wrapped] = nodule[method];
  }

  return nodule[wrapped];
};
