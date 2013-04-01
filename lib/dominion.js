'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, 'shimmer'))
  , domain
  ;

// domains added on node 0.7+, no biggie if they're not available
try { domain = require('domain'); } catch (error) {}

/**
 * CONSTANTS
 */
var MARKER = '__NR_domain';

module.exports = {
  available : domain ? true : false,

  /**
   * Annotate a shared state variable with a domain. SYNCHRONOUS, so throw
   * immediately if the agent's missing -- it's a New Relic developer error if
   * the agent is missing.
   *
   * @param Agent agent The agent holding onto the error tracer.
   * @param State state The shared state for this stage of the
   *                    transaction.
   */
  add : function (agent, state) {
    if (!(state && domain)) return;
    if (!agent) {
      throw new Error("The Agent is where the error handler lives; required.");
    }

    var catcher = domain.create();

    function errored(error) {
      agent.errors.add(state.getTransaction(), error);

      /* To preserve crash semantics, ensure that the New Relic domain is
       * no longer active before rethrowing, which will grant other
       * uncaughtException handlers an opportunity to fire and / or causing
       * node to puke and die just like always.
       */
      catcher.exit();
      if (!process.emit('uncaughtException', error)) throw error;
    }

    catcher[MARKER] = agent;
    catcher.on('error', errored);

    state.domain = catcher;
    if (state.getTransaction() && state.getTransaction().trace) {
      state.getTransaction().trace.domain = catcher;
    }
  },

  /**
   * In Node 0.8, domains were built on the UncaughtException handler in node.cc,
   * catching exceptions that propagated out of the V8 isolate without being
   * handled, and re-emitting them as uncaughtException events on the process
   * global.
   *
   * In Node 0.10, there is a new FatalException handler in node.cc that
   * dispatches thrown objects back into the JS runtime. If a domain is both
   * active and not marked as disposed, the error is emitted as an error event
   * on the domain. Otherwise, an uncaughtException event is emitted on the
   * process global with the error.
   *
   * New Relic's contract with developers is to preserve existing semantics of
   * user code. If dev code is crashing and domains aren't in use, it should
   * crash consistently whether or not the agent is active. Likewise, if code
   * relies on uncaughtException (or uses a module, like Airbrake, that uses
   * uncaughtException) without domains, ensure that uncaughtException will
   * still be emitted. And if they're using domains (go domains WOO), make sure
   * their domain handler gets called.
   *
   * Because the simple act of including the domain module changes
   * _fatalException's dispatch behavior, the agent's use of domains requires
   * us to monkeypatch the JS binding to FatalException to ensure that code
   * crashes consistently between 0.8 and 0.10.
   *
   * @param   Agent   agent   The agent with the error tracer.
   * @param   object  process The process global.
   * @returns boolean Whether the exception was handled.
   */
  initialize : function (agent, process) {
    if (domain && process._fatalException) {
      shimmer.wrapMethod(process, 'process', ['_fatalException'],
                         function (_fatalException) {
        return function wrapped(error) {
          /* Only override default behavior for NR-created domains. Non-NR domains
           * are nested, and should be dispatched back to their domain.
           */
          if (domain.active && domain.active[MARKER]) {
            agent.errors.add(domain.active[MARKER].getTransaction(), error);

            /* If no uncaughtException handler is defined, tell V8 to go bukk
             * wylde and rethrow. ALmost never desirable, but you should
             * be using domains anyway, chief.
             */
            return process.emit('uncaughtException', error);
          }
          else {
            return _fatalException.apply(this, arguments);
          }
        };
      });
    }
  }
};
