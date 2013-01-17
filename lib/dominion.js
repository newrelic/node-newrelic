'use strict';

/**
 * Domain support is only in 0.7+.
 */
var domain;
try {
  domain = require('domain');
}
catch (error) {}

/**
 * Domain disposal doesn't work on 0.8.9 and earlier, so don't
 * try to use it.
 */
var safe = false
  , semver = process.versions.node.split(/\./)
  ;

if (semver[0] > 0) safe = true;
else if (semver[1] >= 8 && semver[2] >= 10) safe = true;

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
      // clean up any pending I/O or timers related to this transaction
      if (safe) state.domain.dispose();

      agent.errors.add(state.getTransaction(), error);
    });

    // for convenience
    state.getTransaction().trace.domain = state.domain;
  }
};
