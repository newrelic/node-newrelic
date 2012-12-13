/**
 * This file includes all of the configuration variables used by the Node.js
 * agent. If there's a configurable element of the agent and it's not described
 * in here, there's been a terrible mistake.
 */
exports.config = {
  /**
   * Array of application names.
   *
   * @env NR_APP_NAME
   */
  app_name : ['MyApplication'],
  /**
   * The user's license key. Must be set by per-app configuration file.
   *
   * @env NR_LICENSE_KEY
   */
  license_key : '',
  /**
   * Hostname for the New Relic collector proxy.
   *
   * You shouldn't need to change this.
   *
   * @env NR_COLLECTOR_HOST
   */
  host : 'collector.newrelic.com',
  /**
   * The port on which the collector proxy will be listening.
   *
   * You shouldn't need to change this.
   *
   * @env NR_COLLECTOR_PORT
   */
  port : 80,
  logging : {
    /**
     * Verbosity of the agent logs. The agent uses bunyan
     * (https://github.com/trentm/node-bunyan) for its logging, and as such
     * the valid logging levels are 'fatal', 'error', 'warn', 'info', 'debug'
     * and 'trace'. Logging at levels 'info' and higher is very terse. For
     * support requests, attaching logs captured at 'trace' level are extremely
     * helpful in chasing down bugs.
     *
     * @env NR_LOGGING_LEVEL
     */
    level : 'info',
    /**
     * Where to put the log file -- by default just uses process.cwd +
     * 'newrelic_agent.log'.
     *
     * @env NR_LOGGING_FILEPATH
     */
    filepath : ''
  },
  /**
   * Whether the agent is enabled.
   *
   * @env NR_AGENT_ENABLED
   */
  agent_enabled : true,
  /**
   * Whether to collect & submit error traces to New Relic.
   *
   * @env NR_ERROR_COLLECTOR_ENABLED
   */
  error_collector : {
    enabled : true,
    /**
     * List of HTTP error status codes the error tracer should disregard.
     * Defaults to 404 NOT FOUND.
     *
     * @env NR_ERROR_COLLECTOR_IGNORE_STATUS_CODES
     */
    ignore_status_codes : [404]
  },
  transaction_tracer : {
    /**
     * Whether to collect & submit slow transaction traces to New Relic.
     *
     * @env NR_TRANSACTION_TRACER_ENABLED
     */
    enabled : true,
    /**
     * The duration at below which the slow transaction tracer should collect a
     * transaction trace. If set to 'apdex_f', the threshold will be set to
     * 4 * apdex_t, which with a default apdex_t value of 500 milliseconds will
     * be 2000 milliseconds.
     *
     * If a time is provided, it is set in milliseconds.
     *
     * @env NR_TRANSACTION_TRACER_TRACE_THRESHOLD
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
     *
     * @env NR_DEBUG_INTERNAL_METRICS
     */
    internal_metrics : false,
    /**
     * Traces the execution of the transaction tracer. Requires logging.level
     * to be set to 'trace' to provide any useful output.
     *
     * @env NR_DEBUG_TRACER_TRACING
     */
    tracer_tracing : false
  }
};
