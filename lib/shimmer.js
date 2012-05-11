var path = require('path');

var agent;

function currentAgent() {
  return agent;
}

var generateShim = function (next, name) {
  if (currentAgent()) {
    var currentTransaction = currentAgent().getTransaction();
    if (currentTransaction && currentTransaction.isFinished()) {
      currentAgent().clearTransaction(currentTransaction);
      currentTransaction = null;
    }
  }

  return function () {
    if (currentAgent()) {
      currentAgent().setTransaction(currentTransaction);
    }
    return next.apply(this, arguments);
  };
};

// Thanks Adam Crabtree! (dude@noderiety.com)
// taken from https://github.com/CrabDude/trycatch
require(path.join(__dirname, 'hook'))(generateShim);

exports.wrapAgent = function (wrapped) {
  agent = wrapped;
};
