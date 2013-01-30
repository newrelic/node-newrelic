/**
 * This file includes all of the configuration variables used by the Node.js
 * agent. If there's a configurable element of the agent and it's not described
 * in here, there's been a terrible mistake.
 */
exports.config = {
  /**
   * Array of application names.
   *
   * @env NEW_RELIC_APP_NAME
   */
  app_name : ['MyApplication'],
  /**
   * The user's license key. Must be set by per-app configuration file.
   *
   * @env NEW_RELIC_LICENSE_KEY
   */
  license_key : '',
  /**
   * Hostname for the New Relic collector proxy.
   *
   * You shouldn't need to change this.
   *
   * @env NEW_RELIC_HOST
   */
  host : 'collector.newrelic.com',
  /**
   * The port on which the collector proxy will be listening.
   *
   * You shouldn't need to change this.
   *
   * @env NEW_RELIC_PORT
   */
  port : 80,
  /**
   * Proxy host to use to connect to the internet.
   *
   * FIXME: proxy support is completely untested.
   *
   * @env NEW_RELIC_PROXY_HOST
   */
  proxy_host : '',
  /**
   * Proxy port to use to connect to the internet.
   *
   * FIXME: proxy support is completely untested.
   *
   * @env NEW_RELIC_PROXY_PORT
   */
  proxy_port : '',
  /**
   * Whether the agent is enabled.
   *
   * @env NEW_RELIC_ENABLED
   */
  agent_enabled : true,
  /**
   * The default Apdex tolerating / threshold value for applications. Node.js
   * is more latency-sensitive than many environments, but New Relic's standard
   * is 0.5 seconds.
   *
   * @env NEW_RELIC_APDEX
   */
  apdex_t : 0.5,
  logging : {
    /**
     * Verbosity of the agent logs. The agent uses bunyan
     * (https://github.com/trentm/node-bunyan) for its logging, and as such
     * the valid logging levels are 'fatal', 'error', 'warn', 'info', 'debug'
     * and 'trace'. Logging at levels 'info' and higher is very terse. For
     * support requests, attaching logs captured at 'trace' level are extremely
     * helpful in chasing down bugs.
     *
     * @env NEW_RELIC_LOG_LEVEL
     */
    level : 'info',
    /**
     * Where to put the log file -- by default just uses process.cwd +
     * 'newrelic_agent.log'. A special case is a filepath of 'stdout',
     * in which case all logging will go to stdout, or 'stderr', in which
     * case all logging will go to stderr.
     *
     * @env NEW_RELIC_LOG
     */
    filepath : require('path').join(process.cwd(), 'newrelic_agent.log')
  },
  /**
   * Whether to collect & submit error traces to New Relic.
   *
   * @env NEW_RELIC_ERROR_COLLECTOR_ENABLED
   */
  error_collector : {
    enabled : true,
    /**
     * List of HTTP error status codes the error tracer should disregard.
     * Defaults to 404 NOT FOUND.
     *
     * @env NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES
     */
    ignore_status_codes : [404]
  },
  transaction_tracer : {
    /**
     * Whether to collect & submit slow transaction traces to New Relic.
     *
     * @env NEW_RELIC_TRACER_ENABLED
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
     * @env NEW_RELIC_TRACER_THRESHOLD
     */
    trace_threshold : 'apdex_f',
    /**
     * The collector defaults to sending 1 transaction trace per harvest cycle.
     * Changing this setting to be greater than 1 will give you more slow transaction
     * traces faster, but it increases the volume of data sent to New Relic, which
     * can affect performance, and may result in noisier data.
     *
     * @env NEW_RELIC_TRACER_TOP_N
     */
    top_n : 1
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
     * @env NEW_RELIC_DEBUG_METRICS
     */
    internal_metrics : false,
    /**
     * Traces the execution of the transaction tracer. Requires logging.level
     * to be set to 'trace' to provide any useful output.
     *
     * @env NEW_RELIC_DEBUG_TRACER
     */
    tracer_tracing : false
  }
};
