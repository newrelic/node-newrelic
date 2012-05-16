var path = require('path');

var agents = [];

var generateShim = function (next, name) {
  for (var i = 0; i < agents.length; i++) {
    var agent = agents[i];
    var transaction = agent.getTransaction();

    if (transaction && transaction.finished) {
      agent.clearTransaction(transaction);
      transaction = null;
    }
  }

  return function () {
    // FIXME: transactions should be scoped to an agent
    for (var j = 0; j < agents.length; j++) {
      agents[j].setTransaction(transaction);
    }

    return next.apply(this, arguments);
  };
};

// Thanks Adam Crabtree! (dude@noderiety.com)
// taken from https://github.com/CrabDude/trycatch
require(path.join(__dirname, 'hook'))(generateShim);

exports.wrapAgent = function (agent) {
  agents.push(agent);
};

exports.unwrapAgent = function (agent) {
  agents = agents.filter(function (item) { return item !== agent; });
};

exports.preserveMethod = function (nodule, method) {
  var wrapped = '__NR_ORIG_' + method;
  if (!nodule[wrapped]) {
    nodule[wrapped] = nodule[method];
  }

  return nodule[wrapped];
};
