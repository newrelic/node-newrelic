'use strict';

var domain;
try {
  var domain = require('domain');
}
catch (error) {}

var dominion = module.exports = {
  available : domain,

  add : function (agent, state) {
    if (!state) return;

    state.domain = domain.create();
    state.domain.on('error', function (error) {
      var transaction;
      if (state.debug) {
        transaction = state.transaction.value;
      }
      else {
        transaction = state.transaction;
      }
      agent.errors.add(transaction, error);
    });

    if (state.debug) {
      state.transaction.value.trace.domain = state.domain;
    }
    else {
      state.transaction.trace.domain = state.domain;
    }
  }
};
