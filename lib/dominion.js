'use strict';

/**
 * Domain support is only in 0.7+.
 */
var domain;
try {
  domain = require('domain');
}
catch (error) {}

module.exports = {
  available : domain ? true : false,

  /**
   * Annotate a shared state variable with a domain.
   *
   * @param Agent agent The agent holding onto the error tracer.
   * @param State state The shared state for this stage of the
   *                    transaction.
   */
  add : function (agent, state) {
    if (!state) return;

    state.domain = domain.create();
    state.domain.on('error', function (error) {
      agent.errors.add(state.getTransaction(), error);
    });

    // for convenience
    state.getTransaction().trace.domain = state.domain;
  }
};
