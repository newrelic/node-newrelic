/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * JSON Schema describing every possible agent configuration field. Core
 * scalar fields, e.g. `agent_enabled = true`, are defined in this root schema
 * file. Complex, object based, fields are defined in their own schema files
 * and referenced here. This is intended to make it easier to maintain
 * and find configuration blocks.
 *
 * Schemas may use `x-` prefixed "keywords" (fields) for agent specific
 * semantics. See https://web.archive.org/web/20260510134735/https://json-schema.org/blog/posts/custom-annotations-will-continue.
 *
 * @type {object}
 */
module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'root.js',
  title: 'New Relic Node.js Agent Configuration',
  description: "Configuration accepted by the New Relic Node.js agent's config file (newrelic.js, newrelic.cjs, or newrelic.mjs), and by the equivalent NEW_RELIC_* environment variables. Generated from lib/config/default.js; regenerate with `node .fleetControl/schemaGeneration/generate-schema.js` after changing that file.",
  type: 'object',

  // `app_name` and `license_key` are intentionally not marked as required
  // even though that would be the most accurate description of our config
  // schema. This is done because we have _many_ historical tests that omit
  // these values. So enforcing them as required will break many tests.
  required: [],
  additionalProperties: true,

  properties: {
    account_id: {
      type: [
        'string',
        'number',
        'null'
      ],
      default: null,
      description: 'The New Relic account ID to attribute serverless trace data to. Only used in serverless_mode; required for distributed tracing to be enabled there. Locally configured values are ignored outside serverless_mode.'
    },

    agent_enabled: {
      'x-newrelic-env-var': 'NEW_RELIC_ENABLED',
      type: 'boolean',
      default: true,
      description: 'Whether the module is enabled.'
    },

    allow_all_headers: {
      type: 'boolean',
      default: false,
      description: "When true, all request headers except for those listed in attributes.exclude will be captured for all traces, unless otherwise specified in a destination's attributes include/exclude lists."
    },

    apdex_t: {
      type: 'number',
      default: 0.1,
      description: "The default Apdex tolerating / threshold value for applications, in seconds. The default for Node is apdexT to 100 milliseconds, which is lower than New Relic standard, but Node.js applications tend to be more latency-sensitive than most. NOTE: This setting can not be modified locally. Use server-side configuration to change your application's apdex."
    },

    apm_lambda_mode: {
      type: 'boolean',
      default: false,
      description: 'When `true`, the AWS Lambda instrumentation will add the necessary data to support the new (as of 2025) unified APM UI.'
    },

    app_name: {
      oneOf: [
        {
          type: 'array',
          items: {
            type: 'string'
          }
        },
        {
          type: 'string'
        }
      ],
      default: [],
      description: 'Array of application names.'
    },

    certificates: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: [],
      description: "Custom SSL certificates If your proxy uses a custom SSL certificate, you can add the CA text to this array, one entry per certificate. The easiest way to do this is with `fs.readFileSync` e.g. certificates: [ require('fs').readFileSync('custom.crt', 'utf8') // don't forget the utf8 ]"
    },

    compressed_content_encoding: {
      type: 'string',
      default: 'gzip',
      description: "If the data compression threshold is reached in the payload, the agent compresses data, using gzip compression by default. The config option `compressed_content_encoding` can be set to 'deflate' to use deflate compression."
    },

    enforce_backstop: {
      type: 'boolean',
      default: true,
      description: "By default, any transactions that are not affected by other bits of naming logic (the API, rules, or metric normalization rules) will have their names set to 'NormalizedUri/*'. Setting this value to false will set them instead to Uri/path/to/resource. Don't change this setting unless you understand the implications of New Relic's metric grouping issues and are confident your application isn't going to run afoul of them. Your application could end up getting blocked! Nobody wants that."
    },

    high_security: {
      type: 'boolean',
      default: false,
      description: 'High Security High security mode (v2) is a setting which prevents any sensitive data from being sent to New Relic. The local setting must match the server setting. If there is a mismatch the agent will log a message and act as if it is disabled. Attributes of high security mode (when enabled): requires SSL does not allow capturing of http params does not allow custom params To read more see: https://docs.newrelic.com/docs/subscriptions/high-security'
    },

    host: {
      type: 'string',
      default: '',
      description: "Hostname for the New Relic collector proxy. You shouldn't need to change this."
    },

    ignore_server_configuration: {
      'x-newrelic-env-var': 'NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG',
      type: 'boolean',
      default: false,
      description: "You may want more control over how your agent is configured and want to disallow the use of New Relic's server-side configuration for agents. To do so, set this to true. env NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG"
    },

    labels: {
      // Either an object of label name/value pairs, or a delimited string
      // (e.g. 'k1:v1;k2:v2'). Both forms are accepted and normalized by
      // lib/util/label-parser.js, which itself truncates over-long keys/values
      // to 255 characters, caps the set at 64, and drops non-string/empty
      // values (with warnings) rather than rejecting them. The schema therefore
      // does not re-impose those limits, which would reject input the agent
      // otherwise accepts.
      oneOf: [
        { type: 'object' },
        { type: 'string' }
      ],
      default: {},
      description: 'Label names and values applied to the data sent from this agent, as an object or a `;`-delimited `key:value` string. Label names and values are truncated to 255 characters and the set is capped at 64.'
    },

    license_key: {
      type: 'string',
      default: '',
      description: "The user's license key. Must be set by per-app configuration file."
    },

    newrelic_home: {
      'x-newrelic-env-var': 'NEW_RELIC_HOME',
      type: [
        'string',
        'null'
      ],
      default: null
    },

    port: {
      type: 'integer',
      default: 443,
      description: "The port on which the collector proxy will be listening. You shouldn't need to change this."
    },

    primary_application_id: {
      type: [
        'string',
        'number',
        'null'
      ],
      default: null,
      description: "The APM application ID to attribute serverless trace data to. Only used in serverless_mode; defaults to 'Unknown' when account_id is set. Locally configured values are ignored outside serverless_mode."
    },

    proxy: {
      'x-newrelic-env-var': 'NEW_RELIC_PROXY_URL',
      type: 'string',
      default: '',
      description: 'Proxy url A proxy url can be used in place of setting proxy_host, proxy_port, proxy_user, and proxy_pass. e.g. http://user:pass@host:port/ Setting proxy will override other proxy settings.'
    },

    proxy_host: {
      type: 'string',
      default: '',
      description: 'Proxy host to use to connect to the internet.'
    },

    proxy_pass: {
      type: 'string',
      default: '',
      description: 'Proxy password when required.'
    },

    proxy_port: {
      type: 'string',
      default: '',
      description: 'Proxy port to use to connect to the internet.'
    },

    proxy_user: {
      type: 'string',
      default: '',
      description: 'Proxy user name when required.'
    },

    ssl: {
      'x-newrelic-env-var': 'NEW_RELIC_USE_SSL',
      type: 'boolean',
      // SSL can no longer be disabled: `const: true` makes ajv reject any value
      // other than true.
      const: true,
      default: true,
      'x-newrelic-internal': true,
      description: 'Whether or not to use SSL to connect to New Relic servers. This can no longer be disabled; the only permitted value is true.'
    },

    trusted_account_key: {
      type: [
        'string',
        'number',
        'null'
      ],
      default: null,
      description: 'The trusted account key used to validate incoming distributed trace headers. Only used in serverless_mode; defaults to account_id when account_id is set. Locally configured values are ignored outside serverless_mode.'
    },

    agent_control: {
      $ref: 'agent-control.js'
    },

    ai_monitoring: {
      $ref: 'ai-monitoring.js'
    },

    api: {
      $ref: 'api.js'
    },

    apollo_server: {
      $ref: 'apollo-server.js'
    },

    application_logging: {
      $ref: 'application-logging.js'
    },

    attributes: {
      $ref: 'attributes.js'
    },

    audit_log: {
      $ref: 'audit-log.js'
    },

    browser_monitoring: {
      $ref: 'browser-monitoring.js'
    },

    cloud: {
      $ref: 'cloud.js'
    },

    code_level_metrics: {
      $ref: 'code-level-metrics.js'
    },

    custom_insights_events: {
      $ref: 'custom-insights-events.js'
    },

    datastore_tracer: {
      $ref: 'datastore-tracer.js'
    },

    distributed_tracing: {
      $ref: 'distributed-tracing.js'
    },

    error_collector: {
      $ref: 'error-collector.js'
    },

    grpc: {
      $ref: 'grpc.js'
    },

    heroku: {
      $ref: 'heroku.js'
    },

    infinite_tracing: {
      $ref: 'infinite-tracing.js'
    },

    instrumentation: {
      $ref: 'instrumentation.js'
    },

    kafka: {
      $ref: 'kafka.js'
    },

    logging: {
      $ref: 'logging.js'
    },

    message_tracer: {
      $ref: 'message-tracer.js'
    },

    opentelemetry: {
      $ref: 'opentelemetry.js'
    },

    plugins: {
      $ref: 'plugins.js'
    },

    process_host: {
      $ref: 'process-host.js'
    },

    profiling: {
      $ref: 'profiling.js'
    },

    rules: {
      $ref: 'rules.js'
    },

    security: {
      $ref: 'security.js'
    },

    serverless_mode: {
      $ref: 'serverless-mode.js'
    },

    slow_sql: {
      $ref: 'slow-sql.js'
    },

    span_events: {
      $ref: 'span-events.js'
    },

    strip_exception_messages: {
      $ref: 'strip-exception-messages.js'
    },

    transaction_events: {
      $ref: 'transaction-events.js'
    },

    transaction_segments: {
      $ref: 'transaction-segments.js'
    },

    transaction_tracer: {
      $ref: 'transaction-tracer.js'
    },

    url_obfuscation: {
      $ref: 'url-obfuscation.js'
    },

    utilization: {
      $ref: 'utilization.js'
    },

    worker_threads: {
      $ref: 'worker-threads.js'
    }
  }
}
