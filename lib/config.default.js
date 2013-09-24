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
  app_name : [],
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
   * You may want more control over how your agent is configured and want to
   * disallow the use of New Relic's server-side configuration for agents. To
   * do so, set this parameter to true. Some configuration information is
   * required to make the agent work properly with the rest of New Relic, but
   * settings such as apdex_t and capture_params will not be overridable by New
   * Relic with this setting in effect.
   *
   * @env NEW_RELIC_IGNORE_SERVER_CONFIGURATION
   */
  ignore_server_configuration : false,
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
  /**
   * Whether to capture parameters in the request URL in slow transaction
   * traces and error traces. Because this can pass sensitive data, it's
   * disabled by default. If there are specific parameters you want ignored,
   * use ignored_params.
   *
   * @env NEW_RELIC_CAPTURE_PARAMS
   */
  capture_params : false,
  /**
   * Array of parameters you don't want captured off request URLs in slow
   * transaction traces and error traces.
   *
   * @env NEW_RELIC_IGNORED_PARAMS
   */
  ignored_params : [],
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
     * be 2 seconds.
     *
     * If a time is provided, it is set in seconds.
     *
     * @env NEW_RELIC_TRACER_THRESHOLD
     */
    transaction_threshold : 'apdex_f',
    /**
     * "Slow trace diversity."
     *
     * By default, the agent captures the slowest transaction trace per a
     * harvest cycle, and will only capture a new trace if the new trace is
     * slower than the previous slowest trace over the last 5 harvest cycles.
     * Increase top_n if you want to have up to top_n different requests (by
     * name) being traced. The agent will always capture at least 5 different
     * slow transactions when it starts up, and will reset capturing
     * different transactions if no slow transactions have been captured for
     * the last 5 harvest cycles.
     *
     * This will allow you to see more information about more of your app's
     * request paths, at the possible cost of not focusing on the absolutely
     * slowest request for that harvest cycle.
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
  },
  /**
   * Rules for naming or ignoring transactions.
   */
  rules : {
    /**
     * A list of rules of the format {pattern : 'pattern', name : 'name'} for
     * matching incoming request URLs and naming the associated New Relic
     * transactions. Both pattern and name are required. Additional attributes
     * are ignored. Patterns may have capture groups (following JavaScript
     * conventions), and names will use $1-style replacement strings. See
     * the documentation for addNamingRule for important caveats.
     *
     * @env NEW_RELIC_NAMING_RULES
     */
    name : [],
    /**
     * A list of patterns for matching incoming request URLs to be ignored by
     * the agent. Patterns may be strings or regular expressions.
     *
     * @env NEW_RELIC_IGNORING_RULES
     */
    ignore : []
  },
  /**
   * By default, any transactions that are not affected by other bits of
   * naming logic (the API, rules, or metric normalization rules) will
   * have their names set to 'NormalizedUri/*'. Setting this value to
   * false will set them instead to Uri/path/to/resource. Don't change
   * this setting unless you understand the implications of New Relic's
   * metric grouping issues and are confident your application isn't going
   * to run afoul of them. Your application could end up getting blackholed!
   * Nobody wants that.
   *
   * @env NEW_RELIC_ENFORCE_BACKSTOP
   */
  enforce_backstop : true
};
