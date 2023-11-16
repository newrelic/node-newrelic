/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultConfig = module.exports
const { array, int, float, boolean, object, objectList, allowList, regex } = require('./formatters')

/**
 * A function that returns the definition of the agent configuration
 * This file includes all of the configuration variables used by the Node.js
 * module. If there's a configurable element of the module and it's not
 * described in here, there's been a terrible mistake.
 *
 * This is used to set a default value, a formatter to run when assigning the value, and
 * an override if the env var does not follow our standard convention.  We should not have
 * to add any more overrides as all new configuration values should follow the convention of
 * `NEW_RELIC_PATH_TO_CONFIG_KEY`
 *
 * @returns {object} configuration definition
 */
defaultConfig.definition = () => ({
  newrelic_home: {
    env: 'NEW_RELIC_HOME',
    default: null
  },

  /**
   * Array of application names.
   */
  app_name: {
    formatter(val) {
      return val.split(/;|,/).map((k) => k.trim())
    },
    default: []
  },
  /**
   * The user's license key. Must be set by per-app configuration file.
   */
  license_key: '',
  /**
   *
   * Enables/Disables security policies.  Paste your security policies
   * token from the New Relic Admin below.
   */
  security_policies_token: '',
  /**
   * Hostname for the New Relic collector proxy.
   *
   * You shouldn't need to change this.
   */
  host: '',
  /**
   * Endpoint to send OpenTelemetry spans to.
   *
   * This should be automatically deduced from your region and other
   * settings, but if desired, you can override it.
   */
  otlp_endpoint: '',
  /**
   * The port on which the collector proxy will be listening.
   *
   * You shouldn't need to change this.
   */
  port: {
    formatter: int,
    default: 443
  },
  /**
   * Whether or not to use SSL to connect to New Relic's servers.
   *
   * NOTE: This option can no longer be disabled.
   */
  ssl: {
    env: 'NEW_RELIC_USE_SSL',
    formatter(_, logger) {
      logger.warn('SSL config key can no longer be disabled, not updating.')
      return true
    },
    default: true
  },
  /**
   * Proxy url
   *
   * A proxy url can be used in place of setting
   * proxy_host, proxy_port, proxy_user, and proxy_pass.
   *
   * e.g. http://user:pass@host:port/
   *
   * Setting proxy will override other proxy settings.
   */
  proxy: {
    env: 'NEW_RELIC_PROXY_URL',
    default: ''
  },
  /**
   * Proxy host to use to connect to the internet.
   */
  proxy_host: '',
  /**
   * Proxy port to use to connect to the internet.
   */
  proxy_port: '',
  /**
   * Proxy user name when required.
   */
  proxy_user: '',
  /**
   * Proxy password when required.
   */
  proxy_pass: '',
  // Serverless DT config defaults
  trusted_account_key: {
    default: null
  },
  primary_application_id: {
    default: null
  },
  account_id: {
    default: null
  },
  /**
   * Custom SSL certificates
   *
   * If your proxy uses a custom SSL certificate, you can add the CA text to
   * this array, one entry per certificate.
   *
   * The easiest way to do this is with `fs.readFileSync` e.g.
   *
   * certificates: [
   *   require('fs').readFileSync('custom.crt', 'utf8') // don't forget the utf8
   * ]
   *
   */
  certificates: {
    formatter: array,
    default: []
  },
  /**
   * Whether the module is enabled.
   */
  agent_enabled: {
    env: 'NEW_RELIC_ENABLED',
    formatter: boolean,
    default: true
  },
  /**
   * The default Apdex tolerating / threshold value for applications, in
   * seconds. The default for Node is apdexT to 100 milliseconds, which is
   * lower than New Relic standard, but Node.js applications tend to be more
   * latency-sensitive than most.
   *
   * NOTE: This setting can not be modified locally. Use server-side configuration
   * to change your application's apdex.
   *
   * @see https://docs.newrelic.com/docs/apm/new-relic-apm/apdex/changing-your-apdex-settings
   */
  apdex_t: {
    formatter: float,
    default: 0.1
  },
  /**
   * When true, all request headers except for those listed in attributes.exclude
   * will be captured for all traces, unless otherwise specified in a destination's
   * attributes include/exclude lists.
   */
  allow_all_headers: {
    formatter: boolean,
    default: false
  },

  /**
   * If the data compression threshold is reached in the payload, the
   * agent compresses data, using gzip compression by default. The
   * config option `compressed_content_encoding` can be set to 'deflate'
   * to use deflate compression.
   */
  compressed_content_encoding: 'gzip',

  /**
   * Attributes are key-value pairs containing information that determines
   * the properties of an event or transaction.
   */
  attributes: {
    /**
     * If `true`, enables capture of attributes for all destinations.
     * If there are specific parameters you want ignored, use `attributes.exclude`.
     */
    enabled: {
      formatter: boolean,
      default: true
    },

    /**
     * Prefix of attributes to exclude from all destinations. Allows * as wildcard at end.
     *
     * NOTE: If excluding headers, they must be in camelCase form to be filtered.
     */
    exclude: {
      formatter: array,
      default: []
    },

    /**
     * Prefix of attributes to include in all destinations. Allows * as wildcard at end.
     *
     * NOTE: If including headers, they must be in camelCase form to be filtered.
     */
    include: {
      formatter: array,
      default: []
    },

    /**
     * If `true`, patterns may be added to the `attributes.include`
     * list.
     */
    include_enabled: {
      formatter: boolean,
      default: true
    },

    /**
     * Controls how many attribute include/exclude rule results are cached by
     * the filter. Increasing this limit will cause greater memory usage and is
     * only necessary if you have an extremely high variety of attributes.
     */
    filter_cache_limit: {
      formatter: int,
      default: 1000
    }
  },
  logging: {
    /**
     * Verbosity of the module's logging. This module uses bunyan
     * (https://github.com/trentm/node-bunyan) for its logging, and as such the
     * valid logging levels are 'fatal', 'error', 'warn', 'info', 'debug' and
     * 'trace'. Logging at levels 'info' and higher is very terse. For support
     * requests, attaching logs captured at 'trace' level are extremely helpful
     * in chasing down bugs.
     */
    level: {
      default: 'info',
      env: 'NEW_RELIC_LOG_LEVEL'
    },
    /**
     * Where to put the log file -- by default just uses process.cwd +
     * 'newrelic_agent.log'. A special case is a filepath of 'stdout',
     * in which case all logging will go to stdout, or 'stderr', in which
     * case all logging will go to stderr.
     */
    filepath: {
      default: require('path').join(process.cwd(), 'newrelic_agent.log'),
      env: 'NEW_RELIC_LOG'
    },
    /**
     * Whether to write to a log file at all
     */
    enabled: {
      formatter: boolean,
      default: true,
      env: 'NEW_RELIC_LOG_ENABLED'
    },

    /**
     * Enables extra debugging at `warn` level. No need to enable except under
     * specific debugging conditions.
     */
    diagnostics: {
      formatter: boolean,
      deafult: false
    }
  },
  audit_log: {
    /**
     * Enables logging of out bound traffic from the Agent to the Collector.
     * This field is ignored if trace level logging is enabled.
     * With trace logging, all traffic is logged.
     */
    enabled: {
      formatter: boolean,
      default: false
    },

    /**
     * Specify which methods are logged. Used in conjunction with the audit_log flag
     * If audit_log is enabled and this property is empty, all methods will be logged
     * Otherwise, if the audit log is enabled, only the methods specified
     * in the filter will be logged
     * Methods include: error_data, metric_data, and analytic_event_data
     */
    endpoints: {
      formatter: array,
      default: []
    }
  },
  /**
   * Whether to collect & submit error traces to New Relic.
   */
  error_collector: {
    attributes: {
      /**
       * If `true`, the agent captures attributes from error collection.
       */
      enabled: {
        formatter: boolean,
        default: true
      },
      /**
       * Prefix of attributes to exclude from error collection.
       * Allows * as wildcard at end.
       */
      exclude: {
        formatter: array,
        default: []
      },
      /**
       * Prefix of attributes to include in error collection.
       * Allows * as wildcard at end.
       */
      include: {
        formatter: array,
        default: []
      }
    },
    /**
     * Disabling the error tracer just means that errors aren't collected
     * and sent to New Relic -- it DOES NOT remove any instrumentation.
     */
    enabled: {
      formatter: boolean,
      default: true
    },
    /**
     * List of HTTP error status codes the error tracer should disregard.
     * Ignoring a status code means that the transaction is not renamed to
     * match the code, and the request is not treated as an error by the error
     * collector.
     *
     * NOTE: This configuration value has no effect on errors recorded using
     * `noticeError()`.
     *
     * Defaults to 404 NOT FOUND.
     */
    ignore_status_codes: {
      env: 'NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES',
      formatter: array,
      default: [404]
    },
    /**
     * Whether error events are collected.
     */
    capture_events: {
      formatter: boolean,
      default: true
    },
    /**
     * The agent will collect all error events up to this number per minute.
     * If there are more than that, a statistical sampling will be collected.
     * Currently this uses a priority sampling algorithm.
     *
     * By increasing this setting you are both increasing the memory
     * requirements of the agent as well as increasing the payload to the New
     * Relic servers. The memory concerns are something you should consider for
     * your own server's sake. The payload of events is compressed, but if it
     * grows too large the New Relic servers may reject it.
     */
    max_event_samples_stored: {
      formatter: int,
      default: 100
    },

    expected_classes: {
      formatter: array,
      default: [],
      env: 'NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERRORS'
    },
    expected_messages: {
      formatter: object,
      default: {}
    },
    expected_status_codes: {
      formatter: array,
      default: [],
      env: 'NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES'
    },
    ignore_classes: {
      formatter: array,
      default: [],
      env: 'NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERRORS'
    },
    ignore_messages: {
      formatter: object,
      default: {}
    }
  },
  /**
   * Error message redaction
   *
   * Options regarding how the agent handles the redaction of error messages.
   *
   */
  strip_exception_messages: {
    /**
     * When `true`, the agent will redact the messages of captured
     * errors.
     */
    enabled: {
      formatter: boolean,
      default: false
    }
  },
  /**
   * Options regarding collecting system information. Used for system
   * utilization based pricing scheme.
   */
  utilization: {
    /**
     * This flag dictates whether the agent attempts to reach out to AWS
     * to get info about the vm the process is running on.
     */
    detect_aws: {
      formatter: boolean,
      default: true
    },
    /**
     * This flag dictates whether the agent attempts to detect if the
     * the process is running on Pivotal Cloud Foundry.
     */
    detect_pcf: {
      formatter: boolean,
      default: true
    },
    /**
     * This flag dictates whether the agent attempts to reach out to Azure to
     * get info about the vm the process is running on.
     */
    detect_azure: {
      formatter: boolean,
      default: true
    },
    /**
     * This flag dictates whether the agent attempts to read files
     * to get info about the container the process is running in.
     *
     * env NEW_RELIC_UTILIZATION_DETECT_DOCKER
     */
    detect_docker: {
      formatter: boolean,
      default: true
    },

    /**
     * This flag dictates whether the agent attempts to reach out to GCP
     * to get info about the vm the process is running on.
     */
    detect_gcp: {
      formatter: boolean,
      default: true
    },

    /**
     * This flag dictates whether the agent attempts to reach out to
     * Kubernetes to get info about the container the process is running on.
     */
    detect_kubernetes: {
      formatter: boolean,
      default: true
    },
    logical_processors: {
      formatter: float,
      default: null
    },
    billing_hostname: {
      default: null
    },
    total_ram_mib: {
      formatter: int,
      default: null
    }
  },
  transaction_tracer: {
    attributes: {
      /**
       * If `true`, the agent captures attributes from transaction traces.
       */
      enabled: {
        formatter: boolean,
        default: true
      },
      /**
       * Prefix of attributes to exclude from transaction traces.
       * Allows * as wildcard at end.
       */
      exclude: {
        formatter: array,
        default: []
      },
      /**
       * Prefix of attributes to include in transaction traces.
       * Allows * as wildcard at end.
       */
      include: {
        formatter: array,
        default: []
      }
    },
    /**
     * Whether to collect & submit slow transaction traces to New Relic. The
     * instrumentation is loaded regardless of this setting, as it's necessary
     * to gather metrics. Disable the agent to prevent the instrumentation from
     * loading.
     */
    enabled: {
      formatter: boolean,
      default: true,
      env: 'NEW_RELIC_TRACER_ENABLED'
    },
    /**
     * The duration at below which the slow transaction tracer should collect a
     * transaction trace. If set to 'apdex_f', the threshold will be set to
     * 4 * apdex_t, which with a default apdex_t value of 500 milliseconds will
     * be 2 seconds.
     *
     * If a time is provided, it is set in seconds.
     */
    transaction_threshold: {
      formatter: float,
      default: 'apdex_f',
      env: 'NEW_RELIC_TRACER_THRESHOLD'
    },
    /**
     * Increase this parameter to increase the diversity of the slow
     * transaction traces recorded by your application over time. Confused?
     * Read on.
     *
     * Transactions are named based on the request (see the README for the
     * details of how requests are mapped to transactions), and top_n refers to
     * the "top n slowest transactions" grouped by these names. The module will
     * only replace a recorded trace with a new trace if the new trace is
     * slower than the previous slowest trace of that name. The default value
     * for this setting is 20, as the transaction trace view page also defaults
     * to showing the 20 slowest transactions.
     *
     * If you want to record the absolute slowest transaction over the last
     * minute, set top_n to 0 or 1. This used to be the default, and has a
     * problem in that it will allow one very slow route to dominate your slow
     * transaction traces.
     *
     * The module will always record at least 5 different slow transactions in
     * the reporting periods after it starts up, and will reset its internal
     * slow trace aggregator if no slow transactions have been recorded for the
     * last 5 harvest cycles, restarting the aggregation process.
     *
     * env NEW_RELIC_TRACER_TOP_N
     */
    top_n: {
      formatter: int,
      default: 20,
      env: 'NEW_RELIC_TRACER_TOP_N'
    },

    /**
     * This option affects both slow-queries and record_sql for transaction
     * traces.  It can have one of 3 values: 'off', 'obfuscated' or 'raw'
     * When it is 'off' no slow queries will be captured, and backtraces
     * and sql will not be included in transaction traces.  If it is 'raw'
     * or 'obfuscated' and other criteria (slow_sql.enabled etc) are met
     * for a query. The raw or obfuscated sql will be included in the
     * transaction trace and a slow query sample will be collected.
     */
    record_sql: {
      formatter: allowList.bind(null, ['off', 'obfuscated', 'raw']),
      default: 'obfuscated',
      env: 'NEW_RELIC_RECORD_SQL'
    },

    /**
     * This option affects both slow-queries and record_sql for transaction
     * traces.  This is the minimum duration a query must take (in ms) for it
     * to be considered for for slow query and inclusion in transaction traces.
     */
    explain_threshold: {
      formatter: int,
      default: 500,
      env: 'NEW_RELIC_EXPLAIN_THRESHOLD'
    }
  },
  /**
   * Rules for naming or ignoring transactions.
   */
  rules: {
    /**
     * A list of rules of the format {pattern: 'pattern', name: 'name'} for
     * matching incoming request URLs and naming the associated New Relic
     * transactions. Both pattern and name are required. Additional attributes
     * are ignored. Patterns may have capture groups (following JavaScript
     * conventions), and names will use $1-style replacement strings. See
     * the documentation for addNamingRule for important caveats.
     */
    name: {
      formatter: objectList,
      default: [],
      env: 'NEW_RELIC_NAMING_RULES'
    },
    /**
     * A list of patterns for matching incoming request URLs to be ignored by
     * the agent. Patterns may be strings or regular expressions.
     *
     * By default, socket.io long-polling is ignored.
     *
     * env NEW_RELIC_IGNORING_RULES
     */
    ignore: {
      formatter: array,
      default: ['^/socket.io/.*/xhr-polling/'],
      env: 'NEW_RELIC_IGNORING_RULES'
    }
  },
  /**
   * By default, any transactions that are not affected by other bits of
   * naming logic (the API, rules, or metric normalization rules) will
   * have their names set to 'NormalizedUri/*'. Setting this value to
   * false will set them instead to Uri/path/to/resource. Don't change
   * this setting unless you understand the implications of New Relic's
   * metric grouping issues and are confident your application isn't going
   * to run afoul of them. Your application could end up getting blocked!
   * Nobody wants that.
   */
  enforce_backstop: {
    formatter: boolean,
    default: true
  },
  /**
   * Browser Monitoring
   *
   * Browser monitoring lets you correlate transactions between the server and browser
   * giving you accurate data on how long a page request takes, from request,
   * through the server response, up until the actual page render completes.
   */
  browser_monitoring: {
    attributes: {
      /**
       * If `true`, the agent captures attributes from browser monitoring.
       */
      enabled: {
        formatter: boolean,
        default: false
      },
      /**
       * Prefix of attributes to exclude from browser monitoring.
       * Allows * as wildcard at end.
       */
      exclude: {
        formatter: array,
        default: []
      },
      /**
       * Prefix of attributes to include in browser monitoring.
       * Allows * as wildcard at end.
       */
      include: {
        formatter: array,
        default: []
      }
    },
    /**
     * Enable browser monitoring header generation.
     *
     * This does not auto-instrument, rather it enables the agent to generate headers.
     * The newrelic module can generate the appropriate <script> header, but you must
     * inject the header yourself, or use a module that does so.
     *
     * Usage:
     *
     *     var newrelic = require('newrelic');
     *
     *     router.get('/', function (req, res) {
     *       var header = newrelic.getBrowserTimingHeader();
     *       res.write(header)
     *       // write the rest of the page
     *     });
     *
     * This generates the <script>...</script> header necessary for Browser Monitoring
     * This script must be manually injected into your templates, as high as possible
     * in the header, but _after_ any X-UA-COMPATIBLE HTTP-EQUIV meta tags.
     * Otherwise you may hurt IE!
     *
     * This method must be called _during_ a transaction, and must be called every
     * time you want to generate the headers.
     *
     * Do *not* reuse the headers between users, or even between requests.
     */
    enable: {
      formatter: boolean,
      default: true,
      env: 'NEW_RELIC_BROWSER_MONITOR_ENABLE'
    },
    /**
     * Request un-minified sources from the server.
     */
    debug: {
      formatter: boolean,
      default: false,
      env: 'NEW_RELIC_BROWSER_MONITOR_DEBUG'
    }
  },
  /**
   * API Configuration
   *
   * Some API end points can be turned off via configuration settings to
   * allow for more flexible security options. All API configuration
   * options are disabled when high-security mode is enabled.
   */
  api: {
    /**
     * Controls for the `API.addCustomAttribute` method.
     */
    custom_attributes_enabled: {
      formatter: boolean,
      default: true,
      env: 'NEW_RELIC_API_CUSTOM_ATTRIBUTES'
    },
    /**
     * Controls for the `API.recordCustomEvent` method.
     */
    custom_events_enabled: {
      formatter: boolean,
      default: true,
      env: 'NEW_RELIC_API_CUSTOM_EVENTS'
    },
    /**
     * Controls for the `API.noticeError` method.
     */
    notice_error_enabled: {
      formatter: boolean,
      default: true,
      env: 'NEW_RELIC_API_NOTICE_ERROR'
    }
  },
  /**
   * Transaction Events
   *
   * Transaction events are sent to New Relic Insights. This event data
   * includes transaction timing, transaction name, and any custom parameters.
   *
   * Read more here: http://newrelic.com/insights
   */
  transaction_events: {
    attributes: {
      /**
       * If `true`, the agent captures attributes from transaction events.
       */
      enabled: {
        formatter: boolean,
        default: true
      },
      /**
       * Prefix of attributes to exclude in transaction events.
       * Allows * as wildcard at end.
       *
       * env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_EXCLUDE
       */
      exclude: {
        formatter: array,
        default: []
      },
      /**
       * Prefix of attributes to include in transaction events.
       * Allows * as wildcard at end.
       *
       * env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_INCLUDE
       */
      include: {
        formatter: array,
        default: []
      }
    },
    /**
     * If this is disabled, the agent does not collect, nor try to send,
     * analytic data.
     */
    enabled: {
      formatter: boolean,
      default: true
    },
    /**
     * The agent will collect all events up to this number per minute. If
     * there are more than that, a statistical sampling will be collected.
     */
    max_samples_stored: {
      formatter: int,
      default: 10000
    }
  },
  /**
   * Custom Insights Events
   *
   * Custom insights events are JSON object that are sent to New Relic
   * Insights. You can tell the agent to send your custom events via the
   * `newrelic.recordCustomEvent()` API. These events are sampled once the max
   * queue size is reached. You can tune this setting below.
   *
   * Read more here: http://newrelic.com/insights
   */
  custom_insights_events: {
    /**
     * If this is disabled, the agent does not collect, nor try to send, custom
     * event data.
     */
    enabled: {
      formatter: boolean,
      default: true
    },
    /**
     * The agent will collect all events up to this number per minute. If there
     * are more than that, a statistical sampling will be collected. Currently
     * this uses a priority sampling algorithm.
     *
     * By increasing this setting you are both increasing the memory
     * requirements of the agent as well as increasing the payload to the New
     * Relic servers. The memory concerns are something you should consider for
     * your own server's sake. The payload of events is compressed, but if it
     * grows too large the New Relic servers may reject it.
     */
    max_samples_stored: {
      formatter: int,
      default: 3000
    }
  },
  /**
   * This is used to configure properties about the user's host name.
   */
  process_host: {
    /**
     * Configurable display name for hosts
     */
    display_name: '',
    /**
     * ip address preference when creating hostnames
     */
    ipv_preference: {
      formatter: allowList.bind(null, ['4', '6']),
      default: '4',
      env: 'NEW_RELIC_IPV_PREFERENCE'
    }
  },
  /**
   * High Security
   *
   * High security mode (v2) is a setting which prevents any sensitive data from
   * being sent to New Relic. The local setting must match the server setting.
   * If there is a mismatch the agent will log a message and act as if it is
   * disabled.
   *
   * Attributes of high security mode (when enabled):
   *  requires SSL
   *  does not allow capturing of http params
   *  does not allow custom params
   *
   * To read more see: https://docs.newrelic.com/docs/subscriptions/high-security
   */
  high_security: {
    formatter: boolean,
    default: false
  },

  /**
   * Labels
   *
   * An object of label names and values that will be applied to the data sent
   * from this agent. Both label names and label values have a maximum length of
   * 255 characters. This object should contain at most 64 labels.
   */
  labels: {
    default: {}
  },
  /**
   * These options control behavior for slow queries, but do not affect sql
   * nodes in transaction traces.
   */
  slow_sql: {
    /**
     * Enables and disables `slow_sql` recording.
     */
    enabled: {
      formatter: boolean,
      default: false
    },

    /**
     * Sets the maximum number of slow query samples that will be collected in a
     * single harvest cycle.
     *
     * env NEW_RELIC_MAX_SQL_SAMPLES
     */
    max_samples: {
      formatter: int,
      default: 10,
      env: 'NEW_RELIC_MAX_SQL_SAMPLES'
    }
  },
  /**
   * Controls behavior of datastore instance metrics.
   *
   * @property {object} instance_reporting container around enabling flag
   * @property {boolean} [instance_reporting.enabled=true]
   *  Enables reporting the host and port/path/id of database servers. Default
   *  is `true`.
   * @property {object} database_name_reporting container around enabling flag
   * @property {boolean} [database_name_reporting.enabled=true]
   *  Enables reporting of database/schema names. Default is `true`.
   */
  datastore_tracer: {
    instance_reporting: {
      enabled: {
        formatter: boolean,
        default: true,
        env: 'NEW_RELIC_DATASTORE_INSTANCE_REPORTING_ENABLED'
      }
    },
    database_name_reporting: {
      enabled: {
        formatter: boolean,
        default: true,
        env: 'NEW_RELIC_DATASTORE_DATABASE_NAME_REPORTING_ENABLED'
      }
    }
  },
  /**
   * Controls behavior of gRPC server instrumentation.
   */
  grpc: {
    /**
     * Enables recording of non-zero gRPC status codes. Default is `true`.
     */
    record_errors: {
      formatter: boolean,
      default: true
    },
    /**
     * List of gRPC error status codes the error tracer should disregard.
     * Ignoring a status code means that the transaction is not renamed to
     * match the code, and the request is not treated as an error by the error
     * collector.
     *
     * NOTE: This configuration value has no effect on errors recorded using
     * `noticeError()`.
     *
     * Defaults to no codes ignored.
     */
    ignore_status_codes: {
      formatter: array,
      default: []
    }
  },
  /**
   * Controls the behavior of span events produced by the agent.
   */
  span_events: {
    /**
     * Enables/disables span event generation
     */
    enabled: {
      formatter: boolean,
      default: true
    },

    attributes: {
      /**
       * If `true`, the agent captures attributes from span events.
       */
      enabled: {
        formatter: boolean,
        default: true
      },
      /**
       * Prefix of attributes to exclude in span events.
       * Allows * as wildcard at end.
       */
      exclude: {
        formatter: array,
        default: []
      },
      /**
       * Prefix of attributes to include in span events.
       * Allows * as wildcard at end.
       */
      include: {
        formatter: array,
        default: []
      }
    },
    /**
     * The agent will collect all events up to this number per minute. If
     * there are more than that, a statistical sampling will be collected.
     */
    max_samples_stored: {
      formatter: int,
      default: 2000
    }
  },
  /**
   * Controls the behavior of transaction segments produced by the agent.
   */
  transaction_segments: {
    attributes: {
      /**
       * If `true`, the agent captures attributes from transaction segments.
       */
      enabled: {
        formatter: boolean,
        default: true
      },
      /**
       * Prefix of attributes to exclude in transaction segments.
       * Allows * as wildcard at end.
       */
      exclude: {
        formatter: array,
        default: []
      },
      /**
       * Prefix of attributes to include in transaction segments.
       * Allows * as wildcard at end.
       */
      include: {
        formatter: array,
        default: []
      }
    }
  },
  /**
   * Controls the method of cross agent tracing in the agent.
   * Distributed tracing lets you see the path that a request takes through your
   * distributed system. Enabling distributed tracing changes the behavior of some
   * New Relic features, so carefully consult the transition guide before you enable
   * this feature: https://docs.newrelic.com/docs/transition-guide-distributed-tracing
   * Default is true.
   */
  distributed_tracing: {
    /**
     * Enables/disables distributed tracing.
     */
    enabled: {
      formatter: boolean,
      default: true
    },

    /**
     * Excludes New Relic format distributed tracing header (`newrelic`) on
     * outbound requests when set to `true`. By default (when false)
     * both W3C TraceContext (`traceparent`, `tracecontext`) and
     * New Relic formats will be sent.
     */
    exclude_newrelic_header: {
      formatter: boolean,
      default: false
    }
  },
  /**
   * Controls the use of cross-application tracing.
   *
   * @property {boolean} [enabled=false]
   * Enables tracing transactions across multiple applications. Default is `false`.
   * This feature has been deprecated in favor of Distributed Tracing (DT).
   * To fully enable this feature, you must also disable DT in your configuration.
   */
  cross_application_tracer: {
    enabled: {
      formatter: boolean,
      default: false
    }
  },
  /**
   * Controls behavior of message broker tracing.
   *
   * @property {object} segment_parameters property around enabling flag
   * @property {boolean} [segment_parameters.enabled=true]
   *  Enables reporting parameters on message broker segments.
   */
  message_tracer: {
    segment_parameters: {
      enabled: {
        formatter: boolean,
        default: true
      }
    }
  },
  /**
   * Controls the use of infinite tracing.
   */
  infinite_tracing: {
    trace_observer: {
      /**
       * The URI HOST of the observer.  Setting this enables infinite tracing.
       */
      host: '',
      /**
       * The URI PORT of the observer.
       */
      port: {
        formatter: int,
        default: 443
      }
    },
    span_events: {
      /**
       * The amount of spans to hold onto before dropping them
       */
      queue_size: {
        formatter: int,
        default: 10000
      }
    },
    batching: {
      formatter: boolean,
      default: true
    },
    compression: {
      formatter: boolean,
      default: true
    }
  },
  /**
   * Specifies whether the agent will be used to monitor serverless functions.
   * For example: AWS Lambda
   */
  serverless_mode: {
    enabled: {
      formatter: boolean,
      default: process.env.AWS_LAMBDA_FUNCTION_NAME != null
    }
  },
  plugins: {
    /**
     * Controls usage of the native metrics module which samples VM and event
     * loop data.
     */
    native_metrics: {
      enabled: {
        formatter: boolean,
        default: true,
        env: 'NEW_RELIC_NATIVE_METRICS_ENABLED'
      }
    }
  },
  /**
   *
   * Controls the behavior of Logs in Context within agent
   */
  application_logging: {
    /**
     * Toggles the ability for all application logging features to be enabled.
     */
    enabled: {
      formatter: boolean,
      default: true
    },
    forwarding: {
      /**
       * Toggles whether the agent gathers log records for sending to New Relic.
       */
      enabled: {
        formatter: boolean,
        default: true
      },
      /**
       * Number of log records to send per minute to New Relic.
       */
      max_samples_stored: {
        formatter: int,
        default: 10000
      }
    },
    metrics: {
      /**
       * Toggles whether the agent gathers logging metrics.
       */
      enabled: {
        formatter: boolean,
        default: true
      }
    },
    local_decorating: {
      /**
       * Toggles whether the agent performs log decoration on standard log output.
       */
      enabled: {
        formatter: boolean,
        default: false
      }
    }
  },
  /**
   * You may want more control over how your agent is configured and want to
   * disallow the use of New Relic's server-side configuration for agents.
   * To do so, set this to true.
   *
   * env NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG
   */
  ignore_server_configuration: {
    formatter: boolean,
    default: false,
    env: 'NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG'
  },

  /**
   * Toggles whether to capture code.* attributes on spans
   */
  code_level_metrics: {
    enabled: {
      formatter: boolean,
      default: true
    }
  },

  /**
   * Obfuscates URL parameters
   * for outgoing and incoming requests
   * for distrubuted tracing attributes - both transaction and span attributes
   * for transaction trace transaction details
   */
  url_obfuscation: {
    /**
     * Toggles whether to obfuscate URL parameters
     */
    enabled: {
      formatter: boolean,
      default: false
    },

    regex: {
      /**
       * A regular expression to match URL parameters to obfuscate
       */
      pattern: {
        formatter: regex,
        default: null
      },

      /**
       * A string containing RegEx flags to use when matching URL parameters
       */
      flags: {
        default: ''
      },

      /**
       * A string containing a replacement value for URL parameters
       * can contain refferences to capture groups in the pattern
       */
      replacement: {
        default: ''
      }
    }
  },
  /**
   * Security agent configurations
   */
  security: {
    /**
     * Toggles the generation of security events by the security agent.
     */
    enabled: {
      formatter: boolean,
      default: false
    },

    /**
     * Flag to tell the Node.js agent to load the security agent.
     * This property is read only once at application start.
     */
    agent: {
      enabled: {
        formatter: boolean,
        default: false
      }
    },

    /**
     *  Security agent provides two modes: IAST and RASP. Default is IAST.
     */
    mode: {
      formatter: allowList.bind(null, ['IAST', 'RASP']),
      default: 'IAST'
    },

    /**
     * Security agent validator URL. Must be prefixed with wss://.
     */
    validator_service_url: {
      default: 'wss://csec.nr-data.net'
    },

    /**
     * Provide ability to toggle sending security events for the following rules.
     */
    detection: {
      rci: {
        enabled: {
          formatter: boolean,
          default: true
        }
      },
      rxss: {
        enabled: {
          formatter: boolean,
          default: true
        }
      },
      deserialization: {
        enabled: {
          formatter: boolean,
          default: true
        }
      }
    }
  },

  /**
   * When enabled, it will use `process.env.DYNO`
   * to set the hostname of the running application
   */
  heroku: {
    use_dyno_names: {
      default: true,
      formatter: boolean
    }
  },

  /**
   * When enabled, it will allow loading of the agent
   * in worker threads.
   *
   * In 11.0.0 we added code to prevent loading in worker threads
   * to cut down on unnecessary overhead of the agent.  We have found
   * in testing that traces and spans were useless unless work was
   * completely self contained in the worker thread.
   */
  worker_threads: {
    enabled: {
      formatter: boolean,
      default: false
    }
  },

  /**
   * When enabled, instrumentation of supported AI libraries will be in
   * effect.
   */
  ai_monitoring: {
    /**
     * Toggles the generation of AI monitoring events by the agent.
     */
    enabled: {
      formatter: boolean,
      default: false
    }
  }
})

/**
 * Creates a new default config
 *
 * @returns {object} default configuration object
 */
defaultConfig.config = () => {
  const config = Object.create(null)
  const definition = defaultConfig.definition()
  buildConfig(definition, config)
  return config
}

/**
 * Iterates over the configuration definition and sets all default
 * values.
 *
 * @param {object} definition configuration definition for a given leaf node
 * @param {object} config object that is used to construct the agent config
 * @param {Array} [paths=[]] an array to capture the leaf node keys to properly assign defaults for nested objects
 * @param {int} [objectKeys=1] amount of keys in a given leaf node
 */
function buildConfig(definition, config, paths = [], objectKeys = 1) {
  let keysSeen = 0
  Object.entries(definition).reduce((conf, [key, value]) => {
    const type = typeof value
    keysSeen++
    if (type === 'string') {
      assignConfigValue({ config: conf, key, value, paths })
    } else if (type === 'object') {
      if (value.hasOwnProperty('default')) {
        assignConfigValue({ config: conf, key, value: value.default, paths })
      } else {
        // add the current leaf node key to the paths and recurse through function again
        const { length } = Object.keys(value)
        paths.push(key)
        buildConfig(definition[key], conf, paths, length)
      }
    }

    return conf
  }, config)

  // we have traversed every key in current object leaf node, remove wrapping key
  // to properly derive env vars of future leaf nodes
  if (keysSeen === objectKeys) {
    paths.pop()
  }
}

/**
 * Assigns a value to a configuration option. In the case of a nested key
 * it will properly build the structure leading to the value
 *
 * @param {object} params args to fn
 * @param {object} params.config object that is used to construct the agent config
 * @param {string} params.key name of the configuration option
 * @param {string} params.value value the configuration option
 * @param {Array} [params.paths=[]] an array to capture the leaf node keys to properly assign defaults for nested objects
 */
function assignConfigValue({ config, key, value, paths }) {
  if (paths.length) {
    setNestedKey(config, [...paths, key], value)
  } else {
    config[key] = value
  }
}

/**
 * Properly sets the value of a nested key by creating the shells of empty parents
 *
 * @param {object} obj object to assign value to
 * @param {Array} keys list of parent keys
 * @param {value} value to assign the nested key
 */
function setNestedKey(obj, keys, value) {
  const len = keys.length
  for (let i = 0; i < len - 1; i++) {
    const elem = keys[i]
    if (!obj[elem]) {
      obj[elem] = {}
    }

    obj = obj[elem]
  }

  obj[keys[len - 1]] = value
}
defaultConfig.setNestedKey = setNestedKey
