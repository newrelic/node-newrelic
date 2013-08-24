'use strict';

// domains added on node 0.7+, no biggie if they're not available
var domain;
try { domain = require('domain'); } catch (error) {}

module.exports = {
  available : domain ? true : false,

  /**
   * Annotate a shared state variable with a domain. SYNCHRONOUS, so throw
   * immediately if the error tracer is missing -- it's a New Relic developer
   * error if it's not passed.
   *
   * @param {ErrorTracer} tracer The error tracer.
   * @param {State}       state  The shared state for this stage of the
   *                             transaction.
   */
  add : function (tracer, state) {
    if (!(state && domain)) return;
    if (!tracer) {
      throw new Error("Must provide a connection to the error tracer");
    }

    var catcher = domain.create();

    function errored(error) {
      var transaction = state.getTransaction();
      tracer.add(transaction, error);

      /* FIXME: ending the transaction is semantically correct, but this opens
       * the possibility of sending incomplete / invalid transaction traces
       * back to NR. Is this bad?
       */
      transaction.end();

      /* To preserve crash semantics, ensure that the New Relic domain is
       * no longer active before rethrowing, which will grant other
       * uncaughtException handlers an opportunity to fire and / or cause
       * node to puke and die just like always.
       */
      catcher.exit();
      if (!process.emit('uncaughtException', error)) throw error;
    }
    catcher.once('error', errored);

    // used only for testing & debugging
    var transaction = state.getTransaction();
    if (transaction && transaction.trace) transaction.trace.domain = catcher;

    // FIXME: consumers must use the bound handler off state
    // TODO: rework to remove side effect dependency
    if (state.getCall()) state.setCall(catcher.bind(state.call));
  }
};
