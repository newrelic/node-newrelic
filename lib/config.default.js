/**
 * This file includes all of the configuration variables used by the Node.js
 * agent. If there's a configurable element of the agent and it's not described
 * in here, there's been a terrible mistake.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name : ['MyApplication'],
  /**
   * The user's license key. Must be set by per-app configuration file.
   */
  license_key : '',
  /**
   * Hostname for the New Relic collector proxy.
   *
   * You shouldn't need to change this.
   */
  host : 'collector.newrelic.com',
  /**
   * The port on which the collector proxy will be listening.
   *
   * You shouldn't need to change this.
   */
  port : 80,
  /**
   * Verbosity of the agent logs. The agent uses bunyan
   * (https://github.com/trentm/node-bunyan) for its logging, and as such
   * the valid logging levels are 'fatal', 'error', 'warn', 'info', 'debug'
   * and 'trace'. Logging at levels 'info' and higher is very terse. For
   * support requests, attaching logs captured at 'trace' level are extremely
   * helpful in chasing down bugs.
   */
  log_level : 'info',
  /**
   * Whether the agent is enabled.
   */
  agent_enabled : true,
  /**
   * Whether to collect & submit error traces to New Relic.
   */
  error_collector : {
    enabled : true,
    /**
     * List of HTTP error status codes the error tracer should disregard.
     * Defaults to 404 NOT FOUND.
     */
    ignore_status_codes : [404]
  },
  /**
   * Whether to collect & submit slow transaction traces to New Relic.
   */
  transaction_tracer : {
    enabled : true,
    /**
     * The duration at below which the slow transaction tracer should collect a
     * transaction trace. If set to 'apdex_f', the threshold will be set to
     * 4 * apdex_t, which with a default apdex_t value of 500 milliseconds will
     * be 2000 milliseconds.
     *
     * If a time is provided, it is set in milliseconds.
     */
    trace_threshold : 'apdex_f'
  },
  /**
   * Whether to enable internal supportability metrics and diagnostics. You're
   * welcome to turn these on, but they will probably be most useful to the
   * New Relic node engineering team.
   */
  debug : {
    /**
     * Whether to collect and submit internal supportability metrics alongside
     * application performance metrics.
     */
    internal_metrics : false,
    /**
     * Traces the execution of the transaction tracer. Requires the log_level
     * to be set to 'trace' to provide any useful output.
     */
    tracer_tracing : false
  }
};
