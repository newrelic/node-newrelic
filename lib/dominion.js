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
      agent.errors.add(state.getTransaction(), error);
      state.domain.dispose();
    });

    state.getTransaction().trace.domain = state.domain;
  }
};
