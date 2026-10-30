/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'

/*
 * GENERATED FILE — DO NOT EDIT.
 *
 * Produced by `npm run generate:config-validator`
 * (bin/generate-config-validator.js) from the agent config JSON Schema in
 * lib/config/schemas/. It is a static, pre-compiled form of the schema so
 * that lib/config/schema.js can obtain the validator via a plain require
 * instead of reading and compiling the schema on every process start.
 * The fully rendered schema lives in lib/config/schema.json.
 */
const { schema, refs, envVarIndex } = 
{
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "root.js",
    "title": "New Relic Node.js Agent Configuration",
    "description": "Configuration accepted by the New Relic Node.js agent's config file (newrelic.js, newrelic.cjs, or newrelic.mjs), and by the equivalent NEW_RELIC_* environment variables.",
    "type": "object",
    "required": [],
    "additionalProperties": true,
    "properties": {
      "account_id": {
        "type": [
          "string",
          "number",
          "null"
        ],
        "default": null,
        "description": "The New Relic account ID to attribute serverless trace data to. Only used in serverless_mode; required for distributed tracing to be enabled there. Locally configured values are ignored outside serverless_mode."
      },
      "agent_enabled": {
        "x-newrelic-env-var": "NEW_RELIC_ENABLED",
        "type": "boolean",
        "default": true,
        "description": "Whether the module is enabled."
      },
      "allow_all_headers": {
        "type": "boolean",
        "default": false,
        "description": "When true, all request headers except for those listed in attributes.exclude will be captured for all traces, unless otherwise specified in a destination's attributes include/exclude lists."
      },
      "apdex_t": {
        "type": "number",
        "default": 0.1,
        "description": "The default Apdex tolerating / threshold value for applications, in seconds. The default for Node is apdexT to 100 milliseconds, which is lower than New Relic standard, but Node.js applications tend to be more latency-sensitive than most. NOTE: This setting can not be modified locally. Use server-side configuration to change your application's apdex."
      },
      "apm_lambda_mode": {
        "type": "boolean",
        "default": false,
        "description": "When `true`, the AWS Lambda instrumentation will add the necessary data to support the new (as of 2025) unified APM UI."
      },
      "app_name": {
        "oneOf": [
          {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          {
            "type": "string"
          }
        ],
        "default": [],
        "description": "Array of application names."
      },
      "certificates": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Custom SSL certificates If your proxy uses a custom SSL certificate, you can add the CA text to this array, one entry per certificate. The easiest way to do this is with `fs.readFileSync` e.g. certificates: [ require('fs').readFileSync('custom.crt', 'utf8') // don't forget the utf8 ]"
      },
      "compressed_content_encoding": {
        "type": "string",
        "default": "gzip",
        "description": "If the data compression threshold is reached in the payload, the agent compresses data, using gzip compression by default. The config option `compressed_content_encoding` can be set to 'deflate' to use deflate compression."
      },
      "enforce_backstop": {
        "type": "boolean",
        "default": true,
        "description": "By default, any transactions that are not affected by other bits of naming logic (the API, rules, or metric normalization rules) will have their names set to 'NormalizedUri/*'. Setting this value to false will set them instead to Uri/path/to/resource. Don't change this setting unless you understand the implications of New Relic's metric grouping issues and are confident your application isn't going to run afoul of them. Your application could end up getting blocked! Nobody wants that."
      },
      "high_security": {
        "type": "boolean",
        "default": false,
        "description": "High Security High security mode (v2) is a setting which prevents any sensitive data from being sent to New Relic. The local setting must match the server setting. If there is a mismatch the agent will log a message and act as if it is disabled. Attributes of high security mode (when enabled): requires SSL does not allow capturing of http params does not allow custom params To read more see: https://docs.newrelic.com/docs/subscriptions/high-security"
      },
      "host": {
        "type": "string",
        "default": "",
        "description": "Hostname for the New Relic collector proxy. You shouldn't need to change this."
      },
      "ignore_server_configuration": {
        "x-newrelic-env-var": "NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG",
        "type": "boolean",
        "default": false,
        "description": "You may want more control over how your agent is configured and want to disallow the use of New Relic's server-side configuration for agents. To do so, set this to true. env NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG"
      },
      "labels": {
        "oneOf": [
          {
            "type": "object"
          },
          {
            "type": "string"
          }
        ],
        "default": {},
        "description": "Label names and values applied to the data sent from this agent, as an object or a `;`-delimited `key:value` string. Label names and values are truncated to 255 characters and the set is capped at 64."
      },
      "license_key": {
        "type": "string",
        "default": "",
        "description": "The user's license key. Must be set by per-app configuration file."
      },
      "newrelic_home": {
        "x-newrelic-env-var": "NEW_RELIC_HOME",
        "type": [
          "string",
          "null"
        ],
        "default": null
      },
      "port": {
        "type": "integer",
        "default": 443,
        "description": "The port on which the collector proxy will be listening. You shouldn't need to change this."
      },
      "primary_application_id": {
        "type": [
          "string",
          "number",
          "null"
        ],
        "default": null,
        "description": "The APM application ID to attribute serverless trace data to. Only used in serverless_mode; defaults to 'Unknown' when account_id is set. Locally configured values are ignored outside serverless_mode."
      },
      "proxy": {
        "x-newrelic-env-var": "NEW_RELIC_PROXY_URL",
        "type": "string",
        "default": "",
        "description": "Proxy url A proxy url can be used in place of setting proxy_host, proxy_port, proxy_user, and proxy_pass. e.g. http://user:pass@host:port/ Setting proxy will override other proxy settings."
      },
      "proxy_host": {
        "type": "string",
        "default": "",
        "description": "Proxy host to use to connect to the internet."
      },
      "proxy_pass": {
        "type": "string",
        "default": "",
        "description": "Proxy password when required."
      },
      "proxy_port": {
        "type": "string",
        "default": "",
        "description": "Proxy port to use to connect to the internet."
      },
      "proxy_user": {
        "type": "string",
        "default": "",
        "description": "Proxy user name when required."
      },
      "ssl": {
        "x-newrelic-env-var": "NEW_RELIC_USE_SSL",
        "type": "boolean",
        "const": true,
        "default": true,
        "x-newrelic-internal": true,
        "description": "Whether or not to use SSL to connect to New Relic servers. This can no longer be disabled; the only permitted value is true."
      },
      "trusted_account_key": {
        "type": [
          "string",
          "number",
          "null"
        ],
        "default": null,
        "description": "The trusted account key used to validate incoming distributed trace headers. Only used in serverless_mode; defaults to account_id when account_id is set. Locally configured values are ignored outside serverless_mode."
      },
      "agent_control": {
        "$ref": "agent-control.js"
      },
      "ai_monitoring": {
        "$ref": "ai-monitoring.js"
      },
      "api": {
        "$ref": "api.js"
      },
      "apollo_server": {
        "$ref": "apollo-server.js"
      },
      "application_logging": {
        "$ref": "application-logging.js"
      },
      "attributes": {
        "$ref": "attributes.js"
      },
      "audit_log": {
        "$ref": "audit-log.js"
      },
      "browser_monitoring": {
        "$ref": "browser-monitoring.js"
      },
      "cloud": {
        "$ref": "cloud.js"
      },
      "code_level_metrics": {
        "$ref": "code-level-metrics.js"
      },
      "custom_insights_events": {
        "$ref": "custom-insights-events.js"
      },
      "datastore_tracer": {
        "$ref": "datastore-tracer.js"
      },
      "distributed_tracing": {
        "$ref": "distributed-tracing.js"
      },
      "error_collector": {
        "$ref": "error-collector.js"
      },
      "grpc": {
        "$ref": "grpc.js"
      },
      "heroku": {
        "$ref": "heroku.js"
      },
      "infinite_tracing": {
        "$ref": "infinite-tracing.js"
      },
      "instrumentation": {
        "$ref": "instrumentation.js"
      },
      "kafka": {
        "$ref": "kafka.js"
      },
      "logging": {
        "$ref": "logging.js"
      },
      "message_tracer": {
        "$ref": "message-tracer.js"
      },
      "opentelemetry": {
        "$ref": "opentelemetry.js"
      },
      "plugins": {
        "$ref": "plugins.js"
      },
      "process_host": {
        "$ref": "process-host.js"
      },
      "profiling": {
        "$ref": "profiling.js"
      },
      "rules": {
        "$ref": "rules.js"
      },
      "security": {
        "$ref": "security.js"
      },
      "serverless_mode": {
        "$ref": "serverless-mode.js"
      },
      "slow_sql": {
        "$ref": "slow-sql.js"
      },
      "span_events": {
        "$ref": "span-events.js"
      },
      "strip_exception_messages": {
        "$ref": "strip-exception-messages.js"
      },
      "transaction_events": {
        "$ref": "transaction-events.js"
      },
      "transaction_segments": {
        "$ref": "transaction-segments.js"
      },
      "transaction_tracer": {
        "$ref": "transaction-tracer.js"
      },
      "url_obfuscation": {
        "$ref": "url-obfuscation.js"
      },
      "utilization": {
        "$ref": "utilization.js"
      },
      "worker_threads": {
        "$ref": "worker-threads.js"
      }
    }
  },
  "refs": {
    "agent-control.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "agent-control.js",
      "type": "object",
      "x-newrelic-internal": true,
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false,
          "description": "Indicates that the agent is being managed by Agent Control. Must be set to true for health monitoring."
        },
        "health": {
          "type": "object",
          "properties": {
            "delivery_location": {
              "type": "string",
              "default": "file:///newrelic/apm/health",
              "description": "A string file path to a directory that the agent is expected to write health status files to. Must be set for health monitoring to be enabled."
            },
            "frequency": {
              "type": "integer",
              "default": 5,
              "description": "An integer representing how often the agent should write to the health status file(s), in seconds."
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true,
      "description": "Settings for integration with Agent Control. Set by Agent Control, not user-facing."
    },
    "ai-monitoring.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "ai-monitoring.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false,
          "description": "Toggles the generation of AI monitoring events by the agent."
        },
        "record_content": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true
            }
          },
          "additionalProperties": true,
          "description": "When enabled, the content of LLM messages will be included in the recorded spans (i.e. delivered to the New Relic collector). This is enabled by default."
        },
        "streaming": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true
            }
          },
          "additionalProperties": true,
          "description": "Toggles the capturing of Llm events when using streaming based methods in AIM supported libraries(i.e.- openai, AWS bedrock, langchain)"
        }
      },
      "additionalProperties": true,
      "description": "When enabled, instrumentation of supported AI libraries will be in effect."
    },
    "api.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "api.js",
      "type": "object",
      "properties": {
        "custom_attributes_enabled": {
          "x-newrelic-env-var": "NEW_RELIC_API_CUSTOM_ATTRIBUTES",
          "type": "boolean",
          "default": true,
          "description": "Controls for the `API.addCustomAttribute` method."
        },
        "custom_events_enabled": {
          "x-newrelic-env-var": "NEW_RELIC_API_CUSTOM_EVENTS",
          "type": "boolean",
          "default": true,
          "description": "Controls for the `API.recordCustomEvent` method."
        },
        "notice_error_enabled": {
          "x-newrelic-env-var": "NEW_RELIC_API_NOTICE_ERROR",
          "type": "boolean",
          "default": true,
          "description": "Controls for the `API.noticeError` method."
        }
      },
      "additionalProperties": true,
      "description": "API Configuration Some API end points can be turned off via configuration settings to allow for more flexible security options. All API configuration options are disabled when high-security mode is enabled."
    },
    "apollo-server.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "apollo-server.js",
      "type": "object",
      "properties": {
        "scalars": {
          "type": "boolean",
          "default": false,
          "description": "Enable capture of timing of fields resolved with the GraphQLScalarType return type. This may be desired when performing time intensive calculations to return a scalar value. This is not recommended for queries that return a large number of pre-calculated scalar fields. NOTE: query/mutation resolvers will always be captured even if returning a scalar type."
        },
        "introspection_queries": {
          "type": "boolean",
          "default": false,
          "description": "Enable capture of timings for an [IntrospectionQuery](https://www.graphql-js.org/api-v16/utilities/#introspectionquery)"
        },
        "service_definition_queries": {
          "type": "boolean",
          "default": false,
          "description": "Enable capture of timings for a [Service Definition query](https://www.apollographql.com/docs/federation/federation-spec/#fetch-service-capabilities) received from an Apollo Federated Gateway Server."
        },
        "health_check_queries": {
          "type": "boolean",
          "default": false,
          "description": "Enable capture of timings for a [Health Check query](https://www.apollographql.com/docs/federation/api/apollo-gateway/#servicehealthcheck) received from an Apollo Federated Gateway Server."
        },
        "field_metrics": {
          "type": "boolean",
          "default": false,
          "description": "Enable capture of metrics for every field and resolver argument seen for an Apollo query. This is intended to be used to check for any unused fields in your graphql schema."
        },
        "collapse_field_metrics": {
          "type": "boolean",
          "default": false,
          "description": "When `field_metrics` is enabled, report list arguments under one metric name without item indexes (for example `ids` instead of `ids.0`, `ids.1`). Each list item still increments the call count of that metric."
        }
      },
      "additionalProperties": true,
      "description": "Stanza for customizing behavior for apollo server instrumentation"
    },
    "application-logging.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "application-logging.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Toggles the ability for all application logging features to be enabled."
        },
        "forwarding": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Toggles whether the agent gathers log records for sending to New Relic."
            },
            "max_samples_stored": {
              "type": "integer",
              "default": 10000,
              "description": "Number of log records to send per minute to New Relic."
            },
            "labels": {
              "type": "object",
              "properties": {
                "enabled": {
                  "type": "boolean",
                  "default": false,
                  "description": "If `true`, the agent attaches labels to log records."
                },
                "exclude": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "default": [],
                  "description": "A case-insensitive array containing the labels to exclude from log records."
                }
              },
              "additionalProperties": true
            }
          },
          "additionalProperties": true
        },
        "metrics": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Toggles whether the agent gathers logging metrics."
            }
          },
          "additionalProperties": true
        },
        "local_decorating": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": false,
              "description": "Toggles whether the agent performs log decoration on standard log output."
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true,
      "description": "Controls the behavior of Logs in Context within agent"
    },
    "attributes.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "attributes.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "If `true`, enables capture of attributes for all destinations. If there are specific parameters you want ignored, use `attributes.exclude`."
        },
        "value_size_limit": {
          "type": "integer",
          "default": 256,
          "maximum": 4096,
          "description": "Defines the number of characters allowed for each individual attribute's value. The default is 256 characters, with a maximum of 4,096."
        },
        "exclude": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": [],
          "description": "Prefix of attributes to exclude from all destinations. Allows * as wildcard at end. NOTE: If excluding headers, they must be in camelCase form to be filtered."
        },
        "include": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": [],
          "description": "Prefix of attributes to include in all destinations. Allows * as wildcard at end. NOTE: If including headers, they must be in camelCase form to be filtered."
        },
        "include_enabled": {
          "type": "boolean",
          "default": true,
          "description": "If `true`, patterns may be added to the `attributes.include` list."
        },
        "filter_cache_limit": {
          "type": "integer",
          "default": 1000,
          "description": "Controls how many attribute include/exclude rule results are cached by the filter. Increasing this limit will cause greater memory usage and is only necessary if you have an extremely high variety of attributes."
        }
      },
      "additionalProperties": true,
      "description": "Attributes are key-value pairs containing information that determines the properties of an event or transaction."
    },
    "audit-log.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "audit-log.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false,
          "description": "Enables logging of out bound traffic from the Agent to the Collector. This field is ignored if trace level logging is enabled. With trace logging, all traffic is logged."
        },
        "endpoints": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": [],
          "description": "Specify which methods are logged. Used in conjunction with the audit_log flag If audit_log is enabled and this property is empty, all methods will be logged Otherwise, if the audit log is enabled, only the methods specified in the filter will be logged Methods include: error_data, metric_data, and analytic_event_data"
        }
      },
      "additionalProperties": true
    },
    "browser-monitoring.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "browser-monitoring.js",
      "type": "object",
      "properties": {
        "attributes": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": false,
              "description": "If `true`, the agent captures attributes from browser monitoring."
            },
            "exclude": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to exclude from browser monitoring. Allows * as wildcard at end."
            },
            "include": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to include in browser monitoring. Allows * as wildcard at end."
            }
          },
          "additionalProperties": true
        },
        "enable": {
          "x-newrelic-env-var": "NEW_RELIC_BROWSER_MONITOR_ENABLE",
          "type": "boolean",
          "default": true,
          "description": "Enable browser monitoring header generation. This does not auto-instrument, rather it enables the agent to generate headers. The newrelic module can generate the appropriate <script> header, but you must inject the header yourself, or use a module that does so. This generates the <script>...</script> header necessary for Browser Monitoring This script must be manually injected into your templates, as high as possible in the header, but _after_ any X-UA-COMPATIBLE HTTP-EQUIV meta tags. Otherwise you may hurt IE! This method must be called _during_ a transaction, and must be called every time you want to generate the headers. Do *not* reuse the headers between users, or even between requests."
        },
        "debug": {
          "x-newrelic-env-var": "NEW_RELIC_BROWSER_MONITOR_DEBUG",
          "type": "boolean",
          "default": false,
          "description": "Request un-minified sources from the server."
        },
        "version": {
          "type": "string",
          "default": "",
          "description": "The browser agent loader version to request, e.g. `\"1.317.0\"`. See the [browser agent EOL policy](https://docs.newrelic.com/docs/browser/browser-monitoring/getting-started/browser-agent-eol-policy/) for which versions are currently available and supported."
        }
      },
      "additionalProperties": true,
      "description": "Browser Monitoring Browser monitoring lets you correlate transactions between the server and browser giving you accurate data on how long a page request takes, from request, through the server response, up until the actual page render completes."
    },
    "cloud.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "cloud.js",
      "type": "object",
      "properties": {
        "aws": {
          "type": "object",
          "properties": {
            "account_id": {
              "type": "integer",
              "default": null,
              "description": "The AWS account ID for the AWS account associated with this app."
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true
    },
    "code-level-metrics.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "code-level-metrics.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": true
        }
      },
      "additionalProperties": true,
      "description": "Toggles whether to capture code.* attributes on spans"
    },
    "custom-insights-events.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "custom-insights-events.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "If this is disabled, the agent does not collect, nor try to send, custom event data."
        },
        "max_samples_stored": {
          "type": "integer",
          "default": 3000,
          "description": "The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected. Currently this uses a priority sampling algorithm. By increasing this setting you are both increasing the memory requirements of the agent as well as increasing the payload to the New Relic servers. The memory concerns are something you should consider for your own server's sake. The payload of events is compressed, but if it grows too large the New Relic servers may reject it."
        }
      },
      "additionalProperties": true,
      "description": "Custom Insights Events Custom insights events are JSON object that are sent to New Relic Insights. You can tell the agent to send your custom events via the `newrelic.recordCustomEvent()` API. These events are sampled once the max queue size is reached. You can tune this setting below. Read more here: http://newrelic.com/insights"
    },
    "datastore-tracer.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "datastore-tracer.js",
      "type": "object",
      "properties": {
        "instance_reporting": {
          "type": "object",
          "properties": {
            "enabled": {
              "x-newrelic-env-var": "NEW_RELIC_DATASTORE_INSTANCE_REPORTING_ENABLED",
              "type": "boolean",
              "default": true
            }
          },
          "additionalProperties": true
        },
        "database_name_reporting": {
          "type": "object",
          "properties": {
            "enabled": {
              "x-newrelic-env-var": "NEW_RELIC_DATASTORE_DATABASE_NAME_REPORTING_ENABLED",
              "type": "boolean",
              "default": true
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true,
      "description": "Controls behavior of datastore instance metrics. Enables reporting the host and port/path/id of database servers. Default is `true`. Enables reporting of database/schema names. Default is `true`."
    },
    "distributed-tracing.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "distributed-tracing.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enables/disables distributed tracing."
        },
        "exclude_newrelic_header": {
          "type": "boolean",
          "default": true,
          "description": "Excludes New Relic format distributed tracing header (`newrelic`) on outbound requests when set to `true`. By default (when false) both W3C TraceContext (`traceparent`, `tracecontext`) and New Relic formats will be sent."
        },
        "sampler": {
          "type": "object",
          "properties": {
            "root": {
              "oneOf": [
                {
                  "type": "string",
                  "enum": [
                    "always_on",
                    "always_off",
                    "adaptive"
                  ]
                },
                {
                  "type": "object",
                  "properties": {
                    "trace_id_ratio_based": {
                      "type": "object",
                      "properties": {
                        "ratio": {
                          "type": "number"
                        }
                      },
                      "required": [
                        "ratio"
                      ],
                      "additionalProperties": true
                    }
                  },
                  "required": [
                    "trace_id_ratio_based"
                  ],
                  "additionalProperties": true
                },
                {
                  "type": "object",
                  "properties": {
                    "adaptive": {
                      "type": "object",
                      "properties": {
                        "sampling_target": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 120
                        }
                      },
                      "additionalProperties": true
                    }
                  },
                  "required": [
                    "adaptive"
                  ],
                  "additionalProperties": true
                }
              ],
              "default": "adaptive",
              "x-newrelic-sampler": true,
              "description": "Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"
            },
            "remote_parent_sampled": {
              "oneOf": [
                {
                  "type": "string",
                  "enum": [
                    "always_on",
                    "always_off",
                    "adaptive"
                  ]
                },
                {
                  "type": "object",
                  "properties": {
                    "trace_id_ratio_based": {
                      "type": "object",
                      "properties": {
                        "ratio": {
                          "type": "number"
                        }
                      },
                      "required": [
                        "ratio"
                      ],
                      "additionalProperties": true
                    }
                  },
                  "required": [
                    "trace_id_ratio_based"
                  ],
                  "additionalProperties": true
                },
                {
                  "type": "object",
                  "properties": {
                    "adaptive": {
                      "type": "object",
                      "properties": {
                        "sampling_target": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 120
                        }
                      },
                      "additionalProperties": true
                    }
                  },
                  "required": [
                    "adaptive"
                  ],
                  "additionalProperties": true
                }
              ],
              "default": "adaptive",
              "x-newrelic-sampler": true,
              "description": "When set to `always_on`, the sampled flag in the `traceparent` header being set to \"true\" will result in the local transaction being sampled with a priority value of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting."
            },
            "remote_parent_not_sampled": {
              "oneOf": [
                {
                  "type": "string",
                  "enum": [
                    "always_on",
                    "always_off",
                    "adaptive"
                  ]
                },
                {
                  "type": "object",
                  "properties": {
                    "trace_id_ratio_based": {
                      "type": "object",
                      "properties": {
                        "ratio": {
                          "type": "number"
                        }
                      },
                      "required": [
                        "ratio"
                      ],
                      "additionalProperties": true
                    }
                  },
                  "required": [
                    "trace_id_ratio_based"
                  ],
                  "additionalProperties": true
                },
                {
                  "type": "object",
                  "properties": {
                    "adaptive": {
                      "type": "object",
                      "properties": {
                        "sampling_target": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 120
                        }
                      },
                      "additionalProperties": true
                    }
                  },
                  "required": [
                    "adaptive"
                  ],
                  "additionalProperties": true
                }
              ],
              "default": "adaptive",
              "x-newrelic-sampler": true,
              "description": "When set to `always_on`, the local transaction will be sampled with a priority of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0."
            },
            "adaptive_sampling_target": {
              "type": "integer",
              "default": 10,
              "minimum": 1,
              "maximum": 120,
              "description": "The sampling target for adaptive sampling is controlled via this attribute when configuring the default/adaptive sampler. The default sampling target is 10 transactions/min when it is not specified but **MUST** be within the range of [1, 120] (inclusive). Upon agent connect, the connect response **MUST** provide the value of `sampling_target` based on this configuration setting's value. The `sampling_target` value from the connect response **SHOULD** be used as the sampling target value for adaptive sampling in the agent."
            },
            "full_granularity": {
              "type": "object",
              "properties": {
                "enabled": {
                  "type": "boolean",
                  "default": true
                }
              },
              "additionalProperties": true
            },
            "partial_granularity": {
              "type": "object",
              "properties": {
                "enabled": {
                  "type": "boolean",
                  "default": false
                },
                "type": {
                  "x-newrelic-coerce": "allowList",
                  "type": "string",
                  "enum": [
                    "compact",
                    "essential",
                    "reduced"
                  ],
                  "default": "essential"
                },
                "root": {
                  "oneOf": [
                    {
                      "type": "string",
                      "enum": [
                        "always_on",
                        "always_off",
                        "adaptive"
                      ]
                    },
                    {
                      "type": "object",
                      "properties": {
                        "trace_id_ratio_based": {
                          "type": "object",
                          "properties": {
                            "ratio": {
                              "type": "number"
                            }
                          },
                          "required": [
                            "ratio"
                          ],
                          "additionalProperties": true
                        }
                      },
                      "required": [
                        "trace_id_ratio_based"
                      ],
                      "additionalProperties": true
                    },
                    {
                      "type": "object",
                      "properties": {
                        "adaptive": {
                          "type": "object",
                          "properties": {
                            "sampling_target": {
                              "type": "integer",
                              "minimum": 1,
                              "maximum": 120
                            }
                          },
                          "additionalProperties": true
                        }
                      },
                      "required": [
                        "adaptive"
                      ],
                      "additionalProperties": true
                    }
                  ],
                  "default": "adaptive",
                  "x-newrelic-sampler": true,
                  "description": "Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"
                },
                "remote_parent_sampled": {
                  "oneOf": [
                    {
                      "type": "string",
                      "enum": [
                        "always_on",
                        "always_off",
                        "adaptive"
                      ]
                    },
                    {
                      "type": "object",
                      "properties": {
                        "trace_id_ratio_based": {
                          "type": "object",
                          "properties": {
                            "ratio": {
                              "type": "number"
                            }
                          },
                          "required": [
                            "ratio"
                          ],
                          "additionalProperties": true
                        }
                      },
                      "required": [
                        "trace_id_ratio_based"
                      ],
                      "additionalProperties": true
                    },
                    {
                      "type": "object",
                      "properties": {
                        "adaptive": {
                          "type": "object",
                          "properties": {
                            "sampling_target": {
                              "type": "integer",
                              "minimum": 1,
                              "maximum": 120
                            }
                          },
                          "additionalProperties": true
                        }
                      },
                      "required": [
                        "adaptive"
                      ],
                      "additionalProperties": true
                    }
                  ],
                  "default": "adaptive",
                  "x-newrelic-sampler": true,
                  "description": "When set to `always_on`, the sampled flag in the `traceparent` header being set to \"true\" will result in the local transaction being sampled with a priority value of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting."
                },
                "remote_parent_not_sampled": {
                  "oneOf": [
                    {
                      "type": "string",
                      "enum": [
                        "always_on",
                        "always_off",
                        "adaptive"
                      ]
                    },
                    {
                      "type": "object",
                      "properties": {
                        "trace_id_ratio_based": {
                          "type": "object",
                          "properties": {
                            "ratio": {
                              "type": "number"
                            }
                          },
                          "required": [
                            "ratio"
                          ],
                          "additionalProperties": true
                        }
                      },
                      "required": [
                        "trace_id_ratio_based"
                      ],
                      "additionalProperties": true
                    },
                    {
                      "type": "object",
                      "properties": {
                        "adaptive": {
                          "type": "object",
                          "properties": {
                            "sampling_target": {
                              "type": "integer",
                              "minimum": 1,
                              "maximum": 120
                            }
                          },
                          "additionalProperties": true
                        }
                      },
                      "required": [
                        "adaptive"
                      ],
                      "additionalProperties": true
                    }
                  ],
                  "default": "adaptive",
                  "x-newrelic-sampler": true,
                  "description": "When set to `always_on`, the local transaction will be sampled with a priority of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0."
                }
              },
              "additionalProperties": true
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true,
      "description": "Controls the method of cross agent tracing in the agent. Distributed tracing lets you see the path that a request takes through your distributed system. Enabling distributed tracing changes the behavior of some New Relic features, so carefully consult the transition guide before you enable this feature: https://docs.newrelic.com/docs/transition-guide-distributed-tracing Default is true."
    },
    "error-collector.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "error-collector.js",
      "type": "object",
      "properties": {
        "attributes": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "If `true`, the agent captures attributes from error collection."
            },
            "exclude": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to exclude from error collection. Allows * as wildcard at end."
            },
            "include": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to include in error collection. Allows * as wildcard at end."
            }
          },
          "additionalProperties": true
        },
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Disabling the error tracer just means that errors aren't collected and sent to New Relic -- it DOES NOT remove any instrumentation."
        },
        "ignore_status_codes": {
          "x-newrelic-env-var": "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES",
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": [
            404
          ],
          "description": "List of HTTP error status codes the error tracer should disregard. Ignoring a status code means that the transaction is not renamed to match the code, and the request is not treated as an error by the error collector. NOTE: This configuration value has no effect on errors recorded using `noticeError()`. Defaults to 404 NOT FOUND."
        },
        "capture_events": {
          "type": "boolean",
          "default": true,
          "description": "Whether error events are collected."
        },
        "max_event_samples_stored": {
          "type": "integer",
          "default": 100,
          "description": "The agent will collect all error events up to this number per minute. If there are more than that, a statistical sampling will be collected. Currently this uses a priority sampling algorithm. By increasing this setting you are both increasing the memory requirements of the agent as well as increasing the payload to the New Relic servers. The memory concerns are something you should consider for your own server's sake. The payload of events is compressed, but if it grows too large the New Relic servers may reject it."
        },
        "expected_classes": {
          "x-newrelic-env-var": "NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERRORS",
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": []
        },
        "expected_messages": {
          "x-newrelic-coerce": "object",
          "type": "object",
          "additionalProperties": true,
          "default": {}
        },
        "expected_status_codes": {
          "x-newrelic-env-var": "NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES",
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": []
        },
        "ignore_classes": {
          "x-newrelic-env-var": "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERRORS",
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": []
        },
        "ignore_messages": {
          "x-newrelic-coerce": "object",
          "type": "object",
          "additionalProperties": true,
          "default": {}
        }
      },
      "additionalProperties": true,
      "description": "Whether to collect & submit error traces to New Relic."
    },
    "grpc.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "grpc.js",
      "type": "object",
      "properties": {
        "record_errors": {
          "type": "boolean",
          "default": true,
          "description": "Enables recording of non-zero gRPC status codes. Default is `true`."
        },
        "ignore_status_codes": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": [],
          "description": "List of gRPC error status codes the error tracer should disregard. Ignoring a status code means that the transaction is not renamed to match the code, and the request is not treated as an error by the error collector. NOTE: This configuration value has no effect on errors recorded using `noticeError()`. Defaults to no codes ignored."
        }
      },
      "additionalProperties": true,
      "description": "Controls behavior of gRPC server instrumentation."
    },
    "heroku.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "heroku.js",
      "type": "object",
      "properties": {
        "use_dyno_names": {
          "type": "boolean",
          "default": true
        }
      },
      "additionalProperties": true,
      "description": "When enabled, it will use `process.env.DYNO` to set the hostname of the running application"
    },
    "infinite-tracing.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "infinite-tracing.js",
      "type": "object",
      "properties": {
        "trace_observer": {
          "type": "object",
          "properties": {
            "host": {
              "type": "string",
              "default": "",
              "description": "The URI HOST of the observer. Setting this enables infinite tracing."
            },
            "port": {
              "type": "integer",
              "default": 443,
              "description": "The URI PORT of the observer."
            },
            "insecure": {
              "type": "boolean",
              "default": false,
              "x-newrelic-internal": true,
              "description": "Whether to connect to the trace observer without TLS. Internal use only."
            }
          },
          "additionalProperties": true
        },
        "span_events": {
          "type": "object",
          "properties": {
            "queue_size": {
              "type": "integer",
              "default": 10000,
              "description": "The amount of spans to hold onto before dropping them"
            },
            "batch_size": {
              "type": "integer",
              "default": 750,
              "description": "Size of batches to post to 8T server"
            }
          },
          "additionalProperties": true
        },
        "batching": {
          "type": "boolean",
          "default": true
        },
        "compression": {
          "type": "boolean",
          "default": true
        }
      },
      "additionalProperties": true,
      "description": "Controls the use of infinite tracing."
    },
    "instrumentation.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "instrumentation.js",
      "type": "object",
      "description": "Stanza that contains all keys to disable core & 3rd party package instrumentation(i.e. dns, http, mongodb, pg, redis, etc) **Note**: Disabling a given library may affect the instrumentation of libraries used after the disabled library. Use at your own risk.",
      "additionalProperties": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "enabled": {
            "type": "boolean",
            "default": true,
            "description": "Whether instrumentation for this module is active."
          }
        }
      },
      "properties": {
        "@anthropic-ai/sdk": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@apollo/server": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@aws-sdk/smithy-client": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@azure/functions": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@elastic/elasticsearch": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@elastic/transport": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@google/adk": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@google/genai": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@grpc/grpc-js": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@hapi/hapi": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@hapi/vision": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@langchain/core": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@langchain/langgraph": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@modelcontextprotocol/sdk": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@modelcontextprotocol/sdk/client/index.js": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@nestjs/core": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@node-redis/client": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@opensearch-project/opensearch": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@prisma/client": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@redis/client": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@smithy/core": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "@smithy/smithy-client": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "amqplib": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "amqplib/callback_api": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "aws-sdk": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "bluebird": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "bunyan": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "cassandra-driver": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "child_process": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "connect": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "crypto": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "dns": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "express": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "fastify": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "fs": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "http": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "http2": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "https": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "ioredis": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "iovalkey": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "kafkajs": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "koa": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "memcached": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "mongodb": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "mysql": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "mysql2": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "net": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "next": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "openai": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "pg": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "pino": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "q": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "redis": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "restify": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "router": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "undici": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "when": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "winston": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        },
        "zlib": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "Whether instrumentation for this module is active."
            }
          }
        }
      }
    },
    "kafka.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "kafka.js",
      "type": "object",
      "properties": {
        "metrics": {
          "type": "object",
          "properties": {
            "cluster": {
              "type": "object",
              "properties": {
                "metrics": {
                  "type": "object",
                  "properties": {
                    "enabled": {
                      "type": "boolean",
                      "default": false,
                      "description": "Enables capture of the `MessageBroker/Kafka/Cluster/{cluster_id}/{Produce|Consume}/{topic_name}` metrics. Disabled by default."
                    }
                  },
                  "additionalProperties": true
                }
              },
              "additionalProperties": true
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true,
      "description": "Stanza for customizing behavior for Kafka instrumentation"
    },
    "logging.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "logging.js",
      "type": "object",
      "properties": {
        "level": {
          "type": "string",
          "default": "info",
          "description": "Verbosity of the module's logging. This module uses bunyan (https://github.com/trentm/node-bunyan) for its logging, and as such the valid logging levels are 'fatal', 'error', 'warn', 'info', 'debug' and 'trace'. Logging at levels 'info' and higher is very terse. For support requests, attaching logs captured at 'trace' level are extremely helpful in chasing down bugs.",
          "x-newrelic-env-var": "NEW_RELIC_LOG_LEVEL"
        },
        "filepath": {
          "type": "string",
          "description": "Where to put the log file -- by default just uses process.cwd + 'newrelic_agent.log'. A special case is a filepath of 'stdout', in which case all logging will go to stdout, or 'stderr', in which case all logging will go to stderr.",
          "x-newrelic-env-var": "NEW_RELIC_LOG"
        },
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Whether to write to a log file at all",
          "x-newrelic-env-var": "NEW_RELIC_LOG_ENABLED"
        },
        "diagnostics": {
          "type": "boolean",
          "default": false,
          "x-newrelic-internal": true,
          "description": "Whether to enable internal agent diagnostics logging."
        }
      },
      "additionalProperties": true
    },
    "message-tracer.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "message-tracer.js",
      "type": "object",
      "properties": {
        "segment_parameters": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true,
      "description": "Controls behavior of message broker tracing. Enables reporting parameters on message broker segments."
    },
    "opentelemetry.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "opentelemetry.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false,
          "description": "Global switch for the whole OpenTelemetry feature. If it is set to `false`, any other sub-feature, e.g. `traces`, will not be enabled regardless of that specific sub-feature setting."
        },
        "traces": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true
            }
          },
          "additionalProperties": true,
          "description": "`traces` are instrumentations, e.g. `@fastify/otel`. Enabling `traces` enables bridging OpenTelemetry instrumentations into the New Relic agent."
        },
        "logs": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true
            }
          },
          "additionalProperties": true,
          "description": "`logs` governs automatic configuration of the OpenTelemetry logs API. When true, the agent will automatically configure the logs API to send logs emitted through the OTEL specific API to New Relic. This feature is dependent on application logs forwarding. Thus, application logs forwarding must be enabled as well."
        },
        "metrics": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true
            },
            "export_interval": {
              "type": "integer",
              "default": 60000,
              "description": "`export_interval` defines the number of milliseconds between each attempt to ship metrics to New Relic. This value must be equal to or greater than the value of `export_timeout`."
            },
            "export_timeout": {
              "type": "integer",
              "default": 10000,
              "description": "`export_timeout` defines the number of milliseconds an export operation is allowed in order to successfully complete. If the timeout is exceeded, it will be reported via the OpenTelemetry diagnostics API."
            }
          },
          "additionalProperties": true,
          "description": "`metrics` governs automatic configuration of the OpenTelemetry metrics API. When `true`, the agent will automatically configure the metrics API to send metrics to New Relic and attach them to the application entity that is instrumented by the New Relic agent."
        }
      },
      "additionalProperties": true,
      "description": "Governs the various OpenTelemetry based features provided by the agent. NOTICE: this configuration is subject to change while the OTEL feature set is in development."
    },
    "plugins.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "plugins.js",
      "type": "object",
      "properties": {
        "native_metrics": {
          "type": "object",
          "properties": {
            "enabled": {
              "x-newrelic-env-var": "NEW_RELIC_NATIVE_METRICS_ENABLED",
              "type": "boolean",
              "default": true
            }
          },
          "additionalProperties": true,
          "description": "Controls usage of the native metrics module which samples VM and event loop data."
        }
      },
      "additionalProperties": true
    },
    "process-host.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "process-host.js",
      "type": "object",
      "properties": {
        "display_name": {
          "type": "string",
          "default": "",
          "description": "Configurable display name for hosts"
        },
        "ipv_preference": {
          "x-newrelic-env-var": "NEW_RELIC_IPV_PREFERENCE",
          "x-newrelic-coerce": "allowList",
          "type": "string",
          "enum": [
            "4",
            "6"
          ],
          "default": "4",
          "description": "ip address preference when creating hostnames"
        }
      },
      "additionalProperties": true,
      "description": "This is used to configure properties about the user's host name."
    },
    "profiling.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "profiling.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false
        },
        "include": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": [
            "cpu",
            "heap"
          ],
          "description": "List of profile type names to enable. Only cpu and heap profiles are currently supported"
        },
        "delay": {
          "type": "integer",
          "default": 0,
          "description": "Delay in milliseconds before starting profiler."
        },
        "duration": {
          "type": "integer",
          "default": 0,
          "description": "If >0, stop profiler after this many milliseconds of operation."
        },
        "source_mapping": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": false,
              "description": "When set to `true`, resolves profiler frames to their original source files/lines using source maps, instead of the compiled output."
            }
          },
          "additionalProperties": true
        },
        "sample_interval": {
          "type": "integer",
          "default": 100,
          "description": "The interval in milliseconds at which to harvest and ingest profile data."
        }
      },
      "additionalProperties": true,
      "description": "Controls the behavior of the profiler."
    },
    "rules.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "rules.js",
      "type": "object",
      "properties": {
        "name": {
          "x-newrelic-env-var": "NEW_RELIC_NAMING_RULES",
          "x-newrelic-coerce": "objectList",
          "type": "array",
          "items": {},
          "default": [],
          "description": "A list of rules of the format {pattern: 'pattern', name: 'name'} for matching incoming request URLs and naming the associated New Relic transactions. Both pattern and name are required. Additional attributes are ignored. Patterns may have capture groups (following JavaScript conventions), and names will use $1-style replacement strings. See the documentation for addNamingRule for important caveats."
        },
        "ignore": {
          "x-newrelic-env-var": "NEW_RELIC_IGNORING_RULES",
          "type": "array",
          "items": {
            "type": [
              "string",
              "object"
            ]
          },
          "default": [
            "^/socket.io/.*/xhr-polling/"
          ],
          "description": "A list of patterns for matching incoming request URLs to be ignored by the agent. Patterns may be strings or regular expressions. By default, socket.io long-polling is ignored. env NEW_RELIC_IGNORING_RULES"
        }
      },
      "additionalProperties": true,
      "description": "Rules for naming or ignoring transactions."
    },
    "security.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "security.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false,
          "description": "Toggles the generation of security events by the security agent."
        },
        "agent": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": false
            }
          },
          "additionalProperties": true,
          "description": "Flag to tell the Node.js agent to load the security agent. This property is read only once at application start."
        },
        "mode": {
          "x-newrelic-coerce": "allowList",
          "type": "string",
          "enum": [
            "IAST",
            "RASP"
          ],
          "default": "IAST",
          "description": "Security agent provides two modes: IAST and RASP. Default is IAST."
        },
        "validator_service_url": {
          "type": "string",
          "default": "wss://csec.nr-data.net",
          "description": "Security agent validator URL. Must be prefixed with wss://."
        },
        "detection": {
          "type": "object",
          "properties": {
            "rci": {
              "type": "object",
              "properties": {
                "enabled": {
                  "type": "boolean",
                  "default": true
                }
              },
              "additionalProperties": true
            },
            "rxss": {
              "type": "object",
              "properties": {
                "enabled": {
                  "type": "boolean",
                  "default": true
                }
              },
              "additionalProperties": true
            },
            "deserialization": {
              "type": "object",
              "properties": {
                "enabled": {
                  "type": "boolean",
                  "default": true
                }
              },
              "additionalProperties": true
            }
          },
          "additionalProperties": true,
          "description": "Provide ability to toggle sending security events for the following rules."
        },
        "iast_test_identifier": {
          "type": "string",
          "default": "",
          "description": "Unique test identifier when running IAST with CI/CD"
        },
        "scan_controllers": {
          "type": "object",
          "properties": {
            "iast_scan_request_rate_limit": {
              "type": "integer",
              "default": 3600,
              "description": "The maximum number of analysis probes or requests that can be sent to the application in one minute."
            },
            "scan_instance_count": {
              "type": "integer",
              "default": 0,
              "description": "The number of application instances for a specific entity where IAST analysis is performed. Values are 0 or 1, 0 signifies run on all application instances"
            }
          },
          "additionalProperties": true,
          "description": "IAST scan controllers to get more control over IAST analysis"
        },
        "scan_schedule": {
          "type": "object",
          "properties": {
            "delay": {
              "type": "integer",
              "default": 0,
              "description": "The delay field specifies the time in minutes before an IAST scan begins after the application starts"
            },
            "duration": {
              "type": "integer",
              "default": 0,
              "description": "The duration field specifies the amount of time in minutes that the IAST scan will run"
            },
            "schedule": {
              "type": "string",
              "default": "",
              "description": "The schedule field specifies a unix cron expression that defines when the IAST scan should run. By default, schedule is disabled"
            },
            "always_sample_traces": {
              "type": "boolean",
              "default": false,
              "description": "Allows IAST to actively collect trace data in the background and the security agent will use this collected data to perform an IAST scan at the scheduled time"
            }
          },
          "additionalProperties": true,
          "description": "Schedule start and stop of IAST scan"
        },
        "exclude_from_iast_scan": {
          "type": "object",
          "properties": {
            "api": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Ignore specific APIs from IAST analysis. The regex pattern should provide a full match for the URL without the endpoint."
            },
            "http_request_parameters": {
              "type": "object",
              "properties": {
                "header": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "default": []
                },
                "query": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "default": []
                },
                "body": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "default": []
                }
              },
              "additionalProperties": true,
              "description": "Ignore specific HTTP request parameters from IAST analysis."
            },
            "iast_detection_category": {
              "type": "object",
              "properties": {
                "insecure_settings": {
                  "type": "boolean",
                  "default": false
                },
                "invalid_file_access": {
                  "type": "boolean",
                  "default": false
                },
                "sql_injection": {
                  "type": "boolean",
                  "default": false
                },
                "nosql_injection": {
                  "type": "boolean",
                  "default": false
                },
                "ldap_injection": {
                  "type": "boolean",
                  "default": false
                },
                "javascript_injection": {
                  "type": "boolean",
                  "default": false
                },
                "command_injection": {
                  "type": "boolean",
                  "default": false
                },
                "xpath_injection": {
                  "type": "boolean",
                  "default": false
                },
                "ssrf": {
                  "type": "boolean",
                  "default": false
                },
                "rxss": {
                  "type": "boolean",
                  "default": false
                }
              },
              "additionalProperties": true,
              "description": "Allows users to specify categories of vulnerabilities for which IAST analysis will be applied or ignored."
            }
          },
          "additionalProperties": true,
          "description": "The exclude from IAST scan setting allows to exclude specific APIs, vulnerability categories, and parameters from IAST analysis."
        }
      },
      "additionalProperties": true,
      "description": "Security agent configurations"
    },
    "serverless-mode.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "serverless-mode.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false,
          "description": "Specifies whether the agent will be used to monitor serverless functions (e.g. AWS Lambda). Defaults to true when the AWS_LAMBDA_FUNCTION_NAME environment variable is present, false otherwise."
        }
      },
      "additionalProperties": true,
      "description": "Specifies whether the agent will be used to monitor serverless functions. For example: AWS Lambda"
    },
    "slow-sql.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "slow-sql.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false,
          "description": "Enables and disables `slow_sql` recording."
        },
        "max_samples": {
          "x-newrelic-env-var": "NEW_RELIC_MAX_SQL_SAMPLES",
          "type": "integer",
          "default": 10,
          "description": "Sets the maximum number of slow query samples that will be collected in a single harvest cycle. env NEW_RELIC_MAX_SQL_SAMPLES"
        }
      },
      "additionalProperties": true,
      "description": "These options control behavior for slow queries, but do not affect sql nodes in transaction traces."
    },
    "span-events.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "span-events.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enables/disables span event generation"
        },
        "attributes": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "If `true`, the agent captures attributes from span events."
            },
            "exclude": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to exclude in span events. Allows * as wildcard at end."
            },
            "include": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to include in span events. Allows * as wildcard at end."
            }
          },
          "additionalProperties": true
        },
        "max_samples_stored": {
          "type": "integer",
          "default": 2000,
          "description": "The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected."
        }
      },
      "additionalProperties": true,
      "description": "Controls the behavior of span events produced by the agent."
    },
    "strip-exception-messages.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "strip-exception-messages.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false,
          "description": "When `true`, the agent will redact the messages of captured errors."
        }
      },
      "additionalProperties": true,
      "description": "Error message redaction Options regarding how the agent handles the redaction of error messages."
    },
    "transaction-events.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "transaction-events.js",
      "type": "object",
      "properties": {
        "attributes": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "If `true`, the agent captures attributes from transaction events."
            },
            "exclude": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to exclude in transaction events. Allows * as wildcard at end. env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_EXCLUDE"
            },
            "include": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to include in transaction events. Allows * as wildcard at end. env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_INCLUDE"
            }
          },
          "additionalProperties": true
        },
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "If this is disabled, the agent does not collect, nor try to send, analytic data."
        },
        "max_samples_stored": {
          "type": "integer",
          "default": 10000,
          "description": "The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected."
        }
      },
      "additionalProperties": true,
      "description": "Transaction Events Transaction events are sent to New Relic Insights. This event data includes transaction timing, transaction name, and any custom parameters. Read more here: http://newrelic.com/insights"
    },
    "transaction-segments.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "transaction-segments.js",
      "type": "object",
      "properties": {
        "attributes": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "If `true`, the agent captures attributes from transaction segments."
            },
            "exclude": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to exclude in transaction segments. Allows * as wildcard at end."
            },
            "include": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to include in transaction segments. Allows * as wildcard at end."
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true,
      "description": "Controls the behavior of transaction segments produced by the agent."
    },
    "transaction-tracer.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "transaction-tracer.js",
      "type": "object",
      "properties": {
        "attributes": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true,
              "description": "If `true`, the agent captures attributes from transaction traces."
            },
            "exclude": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to exclude from transaction traces. Allows * as wildcard at end."
            },
            "include": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Prefix of attributes to include in transaction traces. Allows * as wildcard at end."
            }
          },
          "additionalProperties": true
        },
        "enabled": {
          "x-newrelic-env-var": "NEW_RELIC_TRACER_ENABLED",
          "type": "boolean",
          "default": true,
          "description": "Whether to collect & submit slow transaction traces to New Relic. The instrumentation is loaded regardless of this setting, as it's necessary to gather metrics. Disable the agent to prevent the instrumentation from loading."
        },
        "transaction_threshold": {
          "x-newrelic-env-var": "NEW_RELIC_TRACER_THRESHOLD",
          "x-newrelic-coerce": "numericOrString",
          "type": [
            "number",
            "string"
          ],
          "default": "apdex_f",
          "description": "Sets the time, in seconds, for a transaction to be considered slow. When a transaction exceeds this threshold, a transaction trace will be recorded. When set to 'apdex_f', the threshold will be set to 4 * apdex_t, which with a default apdex_t value of 500 milliseconds will be 2 seconds. If a number is provided, it is set in seconds."
        },
        "top_n": {
          "x-newrelic-env-var": "NEW_RELIC_TRACER_TOP_N",
          "type": "integer",
          "default": 20,
          "description": "Increase this parameter to increase the diversity of the slow transaction traces recorded by your application over time. Confused? Read on. Transactions are named based on the request (see the README for the details of how requests are mapped to transactions), and top_n refers to the \"top n slowest transactions\" grouped by these names. The module will only replace a recorded trace with a new trace if the new trace is slower than the previous slowest trace of that name. The default value for this setting is 20, as the transaction trace view page also defaults to showing the 20 slowest transactions. If you want to record the absolute slowest transaction over the last minute, set top_n to 0 or 1. This used to be the default, and has a problem in that it will allow one very slow route to dominate your slow transaction traces. The module will always record at least 5 different slow transactions in the reporting periods after it starts up, and will reset its internal slow trace aggregator if no slow transactions have been recorded for the last 5 harvest cycles, restarting the aggregation process. env NEW_RELIC_TRACER_TOP_N"
        },
        "record_sql": {
          "x-newrelic-env-var": "NEW_RELIC_RECORD_SQL",
          "x-newrelic-coerce": "allowList",
          "type": "string",
          "enum": [
            "off",
            "obfuscated",
            "raw"
          ],
          "default": "obfuscated",
          "description": "This option affects both slow-queries and record_sql for transaction traces. It can have one of 3 values: 'off', 'obfuscated' or 'raw' When it is 'off' no slow queries will be captured, and backtraces and sql will not be included in transaction traces. If it is 'raw' or 'obfuscated' and other criteria (slow_sql.enabled etc) are met for a query. The raw or obfuscated sql will be included in the transaction trace and a slow query sample will be collected."
        },
        "explain_threshold": {
          "x-newrelic-env-var": "NEW_RELIC_EXPLAIN_THRESHOLD",
          "type": "integer",
          "default": 500,
          "description": "This option affects both slow-queries and record_sql for transaction traces. This is the minimum duration a query must take (in ms) for it to be considered for for slow query and inclusion in transaction traces."
        }
      },
      "additionalProperties": true
    },
    "url-obfuscation.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "url-obfuscation.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false,
          "description": "Toggles whether to obfuscate URL parameters"
        },
        "regex": {
          "type": "object",
          "properties": {
            "pattern": {
              "x-newrelic-coerce": "regex",
              "type": "string",
              "description": "Must be a valid regular expression.",
              "default": null
            },
            "flags": {
              "type": "string",
              "default": "",
              "description": "A string containing RegEx flags to use when matching URL parameters"
            },
            "replacement": {
              "type": "string",
              "default": "",
              "description": "A string containing a replacement value for URL parameters can contain references to capture groups in the pattern"
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true,
      "description": "Obfuscates URL parameters for outgoing and incoming requests for distributed tracing attributes - both transaction and span attributes for transaction trace transaction details"
    },
    "utilization.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "utilization.js",
      "type": "object",
      "properties": {
        "detect_aws": {
          "type": "boolean",
          "default": true,
          "description": "This flag dictates whether the agent attempts to reach out to AWS to get info about the vm the process is running on."
        },
        "detect_pcf": {
          "type": "boolean",
          "default": true,
          "description": "This flag dictates whether the agent attempts to detect if the the process is running on Pivotal Cloud Foundry."
        },
        "detect_azure": {
          "type": "boolean",
          "default": true,
          "description": "This flag dictates whether the agent attempts to reach out to Azure to get info about the vm the process is running on."
        },
        "detect_azurefunction": {
          "type": "boolean",
          "default": true,
          "description": "This flag dictates whether the agent attempts to read environment variables and invocation context to get info about the Azure Function called."
        },
        "detect_docker": {
          "type": "boolean",
          "default": true,
          "description": "This flag dictates whether the agent attempts to read files to get info about the container the process is running in. env NEW_RELIC_UTILIZATION_DETECT_DOCKER"
        },
        "detect_gcp": {
          "type": "boolean",
          "default": true,
          "description": "This flag dictates whether the agent attempts to reach out to GCP to get info about the vm the process is running on."
        },
        "detect_kubernetes": {
          "type": "boolean",
          "default": true,
          "description": "This flag dictates whether the agent attempts to reach out to Kubernetes to get info about the container the process is running on."
        },
        "logical_processors": {
          "type": "number",
          "default": null
        },
        "billing_hostname": {
          "type": [
            "string",
            "null"
          ],
          "default": null
        },
        "total_ram_mib": {
          "type": "integer",
          "default": null
        },
        "gcp_use_instance_as_host": {
          "type": "boolean",
          "default": true,
          "description": "Deprecated and will be removed in v15 of the agent. Please use `utilization.gcp_cloud_run.use_instance_as_host` instead. When enabled, it will use the GCP metadata id to set the hostname of the running application (Services, Worker Pools, and Jobs)."
        },
        "gcp_cloud_run": {
          "type": "object",
          "properties": {
            "include_revision_in_host": {
              "type": "boolean",
              "default": false,
              "description": "If `true`, the agent prepends the Cloud Run revision name to the GCP instance id to form the hostname (`{revision}-{instance id}`) on Google Cloud Run. The revision name comes from `K_REVISION` on a Cloud Run Service, `CLOUD_RUN_REVISION` on a Cloud Run Worker Pool, and `CLOUD_RUN_EXECUTION` on a Cloud Run Job. Has no effect unless `utilization.gcp_use_instance_as_host` is also `true`."
            },
            "use_instance_as_host": {
              "type": "boolean",
              "default": true,
              "description": "When enabled, it will use the GCP metadata id to set the hostname of the running application (Services, Worker Pools, and Jobs)."
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true,
      "description": "Options regarding collecting system information. Used for system utilization based pricing scheme."
    },
    "worker-threads.js": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "worker-threads.js",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false
        }
      },
      "additionalProperties": true,
      "description": "When enabled, it will allow loading of the agent in worker threads. In 11.0.0 we added code to prevent loading in worker threads to cut down on unnecessary overhead of the agent. We have found in testing that traces and spans were useless unless work was completely self contained in the worker thread."
    }
  },
  "envVarIndex": {
    "NEW_RELIC_ACCOUNT_ID": {
      "pathSegments": [
        "account_id"
      ],
      "node": {
        "type": [
          "string",
          "number",
          "null"
        ],
        "default": null,
        "description": "The New Relic account ID to attribute serverless trace data to. Only used in serverless_mode; required for distributed tracing to be enabled there. Locally configured values are ignored outside serverless_mode."
      }
    },
    "NEW_RELIC_ENABLED": {
      "pathSegments": [
        "agent_enabled"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_ENABLED",
        "type": "boolean",
        "default": true,
        "description": "Whether the module is enabled."
      }
    },
    "NEW_RELIC_ALLOW_ALL_HEADERS": {
      "pathSegments": [
        "allow_all_headers"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "When true, all request headers except for those listed in attributes.exclude will be captured for all traces, unless otherwise specified in a destination's attributes include/exclude lists."
      }
    },
    "NEW_RELIC_APDEX_T": {
      "pathSegments": [
        "apdex_t"
      ],
      "node": {
        "type": "number",
        "default": 0.1,
        "description": "The default Apdex tolerating / threshold value for applications, in seconds. The default for Node is apdexT to 100 milliseconds, which is lower than New Relic standard, but Node.js applications tend to be more latency-sensitive than most. NOTE: This setting can not be modified locally. Use server-side configuration to change your application's apdex."
      }
    },
    "NEW_RELIC_APM_LAMBDA_MODE": {
      "pathSegments": [
        "apm_lambda_mode"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "When `true`, the AWS Lambda instrumentation will add the necessary data to support the new (as of 2025) unified APM UI."
      }
    },
    "NEW_RELIC_APP_NAME": {
      "pathSegments": [
        "app_name"
      ],
      "node": {
        "oneOf": [
          {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          {
            "type": "string"
          }
        ],
        "default": [],
        "description": "Array of application names."
      }
    },
    "NEW_RELIC_CERTIFICATES": {
      "pathSegments": [
        "certificates"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Custom SSL certificates If your proxy uses a custom SSL certificate, you can add the CA text to this array, one entry per certificate. The easiest way to do this is with `fs.readFileSync` e.g. certificates: [ require('fs').readFileSync('custom.crt', 'utf8') // don't forget the utf8 ]"
      }
    },
    "NEW_RELIC_COMPRESSED_CONTENT_ENCODING": {
      "pathSegments": [
        "compressed_content_encoding"
      ],
      "node": {
        "type": "string",
        "default": "gzip",
        "description": "If the data compression threshold is reached in the payload, the agent compresses data, using gzip compression by default. The config option `compressed_content_encoding` can be set to 'deflate' to use deflate compression."
      }
    },
    "NEW_RELIC_ENFORCE_BACKSTOP": {
      "pathSegments": [
        "enforce_backstop"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "By default, any transactions that are not affected by other bits of naming logic (the API, rules, or metric normalization rules) will have their names set to 'NormalizedUri/*'. Setting this value to false will set them instead to Uri/path/to/resource. Don't change this setting unless you understand the implications of New Relic's metric grouping issues and are confident your application isn't going to run afoul of them. Your application could end up getting blocked! Nobody wants that."
      }
    },
    "NEW_RELIC_HIGH_SECURITY": {
      "pathSegments": [
        "high_security"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "High Security High security mode (v2) is a setting which prevents any sensitive data from being sent to New Relic. The local setting must match the server setting. If there is a mismatch the agent will log a message and act as if it is disabled. Attributes of high security mode (when enabled): requires SSL does not allow capturing of http params does not allow custom params To read more see: https://docs.newrelic.com/docs/subscriptions/high-security"
      }
    },
    "NEW_RELIC_HOST": {
      "pathSegments": [
        "host"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "Hostname for the New Relic collector proxy. You shouldn't need to change this."
      }
    },
    "NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG": {
      "pathSegments": [
        "ignore_server_configuration"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG",
        "type": "boolean",
        "default": false,
        "description": "You may want more control over how your agent is configured and want to disallow the use of New Relic's server-side configuration for agents. To do so, set this to true. env NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG"
      }
    },
    "NEW_RELIC_LABELS": {
      "pathSegments": [
        "labels"
      ],
      "node": {
        "oneOf": [
          {
            "type": "object"
          },
          {
            "type": "string"
          }
        ],
        "default": {},
        "description": "Label names and values applied to the data sent from this agent, as an object or a `;`-delimited `key:value` string. Label names and values are truncated to 255 characters and the set is capped at 64."
      }
    },
    "NEW_RELIC_LICENSE_KEY": {
      "pathSegments": [
        "license_key"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "The user's license key. Must be set by per-app configuration file."
      }
    },
    "NEW_RELIC_HOME": {
      "pathSegments": [
        "newrelic_home"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_HOME",
        "type": [
          "string",
          "null"
        ],
        "default": null
      }
    },
    "NEW_RELIC_PORT": {
      "pathSegments": [
        "port"
      ],
      "node": {
        "type": "integer",
        "default": 443,
        "description": "The port on which the collector proxy will be listening. You shouldn't need to change this."
      }
    },
    "NEW_RELIC_PRIMARY_APPLICATION_ID": {
      "pathSegments": [
        "primary_application_id"
      ],
      "node": {
        "type": [
          "string",
          "number",
          "null"
        ],
        "default": null,
        "description": "The APM application ID to attribute serverless trace data to. Only used in serverless_mode; defaults to 'Unknown' when account_id is set. Locally configured values are ignored outside serverless_mode."
      }
    },
    "NEW_RELIC_PROXY_URL": {
      "pathSegments": [
        "proxy"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_PROXY_URL",
        "type": "string",
        "default": "",
        "description": "Proxy url A proxy url can be used in place of setting proxy_host, proxy_port, proxy_user, and proxy_pass. e.g. http://user:pass@host:port/ Setting proxy will override other proxy settings."
      }
    },
    "NEW_RELIC_PROXY_HOST": {
      "pathSegments": [
        "proxy_host"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "Proxy host to use to connect to the internet."
      }
    },
    "NEW_RELIC_PROXY_PASS": {
      "pathSegments": [
        "proxy_pass"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "Proxy password when required."
      }
    },
    "NEW_RELIC_PROXY_PORT": {
      "pathSegments": [
        "proxy_port"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "Proxy port to use to connect to the internet."
      }
    },
    "NEW_RELIC_PROXY_USER": {
      "pathSegments": [
        "proxy_user"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "Proxy user name when required."
      }
    },
    "NEW_RELIC_USE_SSL": {
      "pathSegments": [
        "ssl"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_USE_SSL",
        "type": "boolean",
        "const": true,
        "default": true,
        "x-newrelic-internal": true,
        "description": "Whether or not to use SSL to connect to New Relic servers. This can no longer be disabled; the only permitted value is true."
      }
    },
    "NEW_RELIC_TRUSTED_ACCOUNT_KEY": {
      "pathSegments": [
        "trusted_account_key"
      ],
      "node": {
        "type": [
          "string",
          "number",
          "null"
        ],
        "default": null,
        "description": "The trusted account key used to validate incoming distributed trace headers. Only used in serverless_mode; defaults to account_id when account_id is set. Locally configured values are ignored outside serverless_mode."
      }
    },
    "NEW_RELIC_AGENT_CONTROL_ENABLED": {
      "pathSegments": [
        "agent_control",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Indicates that the agent is being managed by Agent Control. Must be set to true for health monitoring."
      }
    },
    "NEW_RELIC_AGENT_CONTROL_HEALTH_DELIVERY_LOCATION": {
      "pathSegments": [
        "agent_control",
        "health",
        "delivery_location"
      ],
      "node": {
        "type": "string",
        "default": "file:///newrelic/apm/health",
        "description": "A string file path to a directory that the agent is expected to write health status files to. Must be set for health monitoring to be enabled."
      }
    },
    "NEW_RELIC_AGENT_CONTROL_HEALTH_FREQUENCY": {
      "pathSegments": [
        "agent_control",
        "health",
        "frequency"
      ],
      "node": {
        "type": "integer",
        "default": 5,
        "description": "An integer representing how often the agent should write to the health status file(s), in seconds."
      }
    },
    "NEW_RELIC_AI_MONITORING_ENABLED": {
      "pathSegments": [
        "ai_monitoring",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Toggles the generation of AI monitoring events by the agent."
      }
    },
    "NEW_RELIC_AI_MONITORING_RECORD_CONTENT_ENABLED": {
      "pathSegments": [
        "ai_monitoring",
        "record_content",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_AI_MONITORING_STREAMING_ENABLED": {
      "pathSegments": [
        "ai_monitoring",
        "streaming",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_API_CUSTOM_ATTRIBUTES": {
      "pathSegments": [
        "api",
        "custom_attributes_enabled"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_API_CUSTOM_ATTRIBUTES",
        "type": "boolean",
        "default": true,
        "description": "Controls for the `API.addCustomAttribute` method."
      }
    },
    "NEW_RELIC_API_CUSTOM_EVENTS": {
      "pathSegments": [
        "api",
        "custom_events_enabled"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_API_CUSTOM_EVENTS",
        "type": "boolean",
        "default": true,
        "description": "Controls for the `API.recordCustomEvent` method."
      }
    },
    "NEW_RELIC_API_NOTICE_ERROR": {
      "pathSegments": [
        "api",
        "notice_error_enabled"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_API_NOTICE_ERROR",
        "type": "boolean",
        "default": true,
        "description": "Controls for the `API.noticeError` method."
      }
    },
    "NEW_RELIC_APOLLO_SERVER_SCALARS": {
      "pathSegments": [
        "apollo_server",
        "scalars"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Enable capture of timing of fields resolved with the GraphQLScalarType return type. This may be desired when performing time intensive calculations to return a scalar value. This is not recommended for queries that return a large number of pre-calculated scalar fields. NOTE: query/mutation resolvers will always be captured even if returning a scalar type."
      }
    },
    "NEW_RELIC_APOLLO_SERVER_INTROSPECTION_QUERIES": {
      "pathSegments": [
        "apollo_server",
        "introspection_queries"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Enable capture of timings for an [IntrospectionQuery](https://www.graphql-js.org/api-v16/utilities/#introspectionquery)"
      }
    },
    "NEW_RELIC_APOLLO_SERVER_SERVICE_DEFINITION_QUERIES": {
      "pathSegments": [
        "apollo_server",
        "service_definition_queries"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Enable capture of timings for a [Service Definition query](https://www.apollographql.com/docs/federation/federation-spec/#fetch-service-capabilities) received from an Apollo Federated Gateway Server."
      }
    },
    "NEW_RELIC_APOLLO_SERVER_HEALTH_CHECK_QUERIES": {
      "pathSegments": [
        "apollo_server",
        "health_check_queries"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Enable capture of timings for a [Health Check query](https://www.apollographql.com/docs/federation/api/apollo-gateway/#servicehealthcheck) received from an Apollo Federated Gateway Server."
      }
    },
    "NEW_RELIC_APOLLO_SERVER_FIELD_METRICS": {
      "pathSegments": [
        "apollo_server",
        "field_metrics"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Enable capture of metrics for every field and resolver argument seen for an Apollo query. This is intended to be used to check for any unused fields in your graphql schema."
      }
    },
    "NEW_RELIC_APOLLO_SERVER_COLLAPSE_FIELD_METRICS": {
      "pathSegments": [
        "apollo_server",
        "collapse_field_metrics"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "When `field_metrics` is enabled, report list arguments under one metric name without item indexes (for example `ids` instead of `ids.0`, `ids.1`). Each list item still increments the call count of that metric."
      }
    },
    "NEW_RELIC_APPLICATION_LOGGING_ENABLED": {
      "pathSegments": [
        "application_logging",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Toggles the ability for all application logging features to be enabled."
      }
    },
    "NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED": {
      "pathSegments": [
        "application_logging",
        "forwarding",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Toggles whether the agent gathers log records for sending to New Relic."
      }
    },
    "NEW_RELIC_APPLICATION_LOGGING_FORWARDING_MAX_SAMPLES_STORED": {
      "pathSegments": [
        "application_logging",
        "forwarding",
        "max_samples_stored"
      ],
      "node": {
        "type": "integer",
        "default": 10000,
        "description": "Number of log records to send per minute to New Relic."
      }
    },
    "NEW_RELIC_APPLICATION_LOGGING_FORWARDING_LABELS_ENABLED": {
      "pathSegments": [
        "application_logging",
        "forwarding",
        "labels",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "If `true`, the agent attaches labels to log records."
      }
    },
    "NEW_RELIC_APPLICATION_LOGGING_FORWARDING_LABELS_EXCLUDE": {
      "pathSegments": [
        "application_logging",
        "forwarding",
        "labels",
        "exclude"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "A case-insensitive array containing the labels to exclude from log records."
      }
    },
    "NEW_RELIC_APPLICATION_LOGGING_METRICS_ENABLED": {
      "pathSegments": [
        "application_logging",
        "metrics",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Toggles whether the agent gathers logging metrics."
      }
    },
    "NEW_RELIC_APPLICATION_LOGGING_LOCAL_DECORATING_ENABLED": {
      "pathSegments": [
        "application_logging",
        "local_decorating",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Toggles whether the agent performs log decoration on standard log output."
      }
    },
    "NEW_RELIC_ATTRIBUTES_ENABLED": {
      "pathSegments": [
        "attributes",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "If `true`, enables capture of attributes for all destinations. If there are specific parameters you want ignored, use `attributes.exclude`."
      }
    },
    "NEW_RELIC_ATTRIBUTES_VALUE_SIZE_LIMIT": {
      "pathSegments": [
        "attributes",
        "value_size_limit"
      ],
      "node": {
        "type": "integer",
        "default": 256,
        "maximum": 4096,
        "description": "Defines the number of characters allowed for each individual attribute's value. The default is 256 characters, with a maximum of 4,096."
      }
    },
    "NEW_RELIC_ATTRIBUTES_EXCLUDE": {
      "pathSegments": [
        "attributes",
        "exclude"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to exclude from all destinations. Allows * as wildcard at end. NOTE: If excluding headers, they must be in camelCase form to be filtered."
      }
    },
    "NEW_RELIC_ATTRIBUTES_INCLUDE": {
      "pathSegments": [
        "attributes",
        "include"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to include in all destinations. Allows * as wildcard at end. NOTE: If including headers, they must be in camelCase form to be filtered."
      }
    },
    "NEW_RELIC_ATTRIBUTES_INCLUDE_ENABLED": {
      "pathSegments": [
        "attributes",
        "include_enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "If `true`, patterns may be added to the `attributes.include` list."
      }
    },
    "NEW_RELIC_ATTRIBUTES_FILTER_CACHE_LIMIT": {
      "pathSegments": [
        "attributes",
        "filter_cache_limit"
      ],
      "node": {
        "type": "integer",
        "default": 1000,
        "description": "Controls how many attribute include/exclude rule results are cached by the filter. Increasing this limit will cause greater memory usage and is only necessary if you have an extremely high variety of attributes."
      }
    },
    "NEW_RELIC_AUDIT_LOG_ENABLED": {
      "pathSegments": [
        "audit_log",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Enables logging of out bound traffic from the Agent to the Collector. This field is ignored if trace level logging is enabled. With trace logging, all traffic is logged."
      }
    },
    "NEW_RELIC_AUDIT_LOG_ENDPOINTS": {
      "pathSegments": [
        "audit_log",
        "endpoints"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Specify which methods are logged. Used in conjunction with the audit_log flag If audit_log is enabled and this property is empty, all methods will be logged Otherwise, if the audit log is enabled, only the methods specified in the filter will be logged Methods include: error_data, metric_data, and analytic_event_data"
      }
    },
    "NEW_RELIC_BROWSER_MONITORING_ATTRIBUTES_ENABLED": {
      "pathSegments": [
        "browser_monitoring",
        "attributes",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "If `true`, the agent captures attributes from browser monitoring."
      }
    },
    "NEW_RELIC_BROWSER_MONITORING_ATTRIBUTES_EXCLUDE": {
      "pathSegments": [
        "browser_monitoring",
        "attributes",
        "exclude"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to exclude from browser monitoring. Allows * as wildcard at end."
      }
    },
    "NEW_RELIC_BROWSER_MONITORING_ATTRIBUTES_INCLUDE": {
      "pathSegments": [
        "browser_monitoring",
        "attributes",
        "include"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to include in browser monitoring. Allows * as wildcard at end."
      }
    },
    "NEW_RELIC_BROWSER_MONITOR_ENABLE": {
      "pathSegments": [
        "browser_monitoring",
        "enable"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_BROWSER_MONITOR_ENABLE",
        "type": "boolean",
        "default": true,
        "description": "Enable browser monitoring header generation. This does not auto-instrument, rather it enables the agent to generate headers. The newrelic module can generate the appropriate <script> header, but you must inject the header yourself, or use a module that does so. This generates the <script>...</script> header necessary for Browser Monitoring This script must be manually injected into your templates, as high as possible in the header, but _after_ any X-UA-COMPATIBLE HTTP-EQUIV meta tags. Otherwise you may hurt IE! This method must be called _during_ a transaction, and must be called every time you want to generate the headers. Do *not* reuse the headers between users, or even between requests."
      }
    },
    "NEW_RELIC_BROWSER_MONITOR_DEBUG": {
      "pathSegments": [
        "browser_monitoring",
        "debug"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_BROWSER_MONITOR_DEBUG",
        "type": "boolean",
        "default": false,
        "description": "Request un-minified sources from the server."
      }
    },
    "NEW_RELIC_BROWSER_MONITORING_VERSION": {
      "pathSegments": [
        "browser_monitoring",
        "version"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "The browser agent loader version to request, e.g. `\"1.317.0\"`. See the [browser agent EOL policy](https://docs.newrelic.com/docs/browser/browser-monitoring/getting-started/browser-agent-eol-policy/) for which versions are currently available and supported."
      }
    },
    "NEW_RELIC_CLOUD_AWS_ACCOUNT_ID": {
      "pathSegments": [
        "cloud",
        "aws",
        "account_id"
      ],
      "node": {
        "type": "integer",
        "default": null,
        "description": "The AWS account ID for the AWS account associated with this app."
      }
    },
    "NEW_RELIC_CODE_LEVEL_METRICS_ENABLED": {
      "pathSegments": [
        "code_level_metrics",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_CUSTOM_INSIGHTS_EVENTS_ENABLED": {
      "pathSegments": [
        "custom_insights_events",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "If this is disabled, the agent does not collect, nor try to send, custom event data."
      }
    },
    "NEW_RELIC_CUSTOM_INSIGHTS_EVENTS_MAX_SAMPLES_STORED": {
      "pathSegments": [
        "custom_insights_events",
        "max_samples_stored"
      ],
      "node": {
        "type": "integer",
        "default": 3000,
        "description": "The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected. Currently this uses a priority sampling algorithm. By increasing this setting you are both increasing the memory requirements of the agent as well as increasing the payload to the New Relic servers. The memory concerns are something you should consider for your own server's sake. The payload of events is compressed, but if it grows too large the New Relic servers may reject it."
      }
    },
    "NEW_RELIC_DATASTORE_INSTANCE_REPORTING_ENABLED": {
      "pathSegments": [
        "datastore_tracer",
        "instance_reporting",
        "enabled"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_DATASTORE_INSTANCE_REPORTING_ENABLED",
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_DATASTORE_DATABASE_NAME_REPORTING_ENABLED": {
      "pathSegments": [
        "datastore_tracer",
        "database_name_reporting",
        "enabled"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_DATASTORE_DATABASE_NAME_REPORTING_ENABLED",
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_ENABLED": {
      "pathSegments": [
        "distributed_tracing",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Enables/disables distributed tracing."
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_EXCLUDE_NEWRELIC_HEADER": {
      "pathSegments": [
        "distributed_tracing",
        "exclude_newrelic_header"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Excludes New Relic format distributed tracing header (`newrelic`) on outbound requests when set to `true`. By default (when false) both W3C TraceContext (`traceparent`, `tracecontext`) and New Relic formats will be sent."
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_ROOT": {
      "pathSegments": [
        "distributed_tracing",
        "sampler",
        "root"
      ],
      "node": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "always_on",
              "always_off",
              "adaptive"
            ]
          },
          {
            "type": "object",
            "properties": {
              "trace_id_ratio_based": {
                "type": "object",
                "properties": {
                  "ratio": {
                    "type": "number"
                  }
                },
                "required": [
                  "ratio"
                ],
                "additionalProperties": true
              }
            },
            "required": [
              "trace_id_ratio_based"
            ],
            "additionalProperties": true
          },
          {
            "type": "object",
            "properties": {
              "adaptive": {
                "type": "object",
                "properties": {
                  "sampling_target": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 120
                  }
                },
                "additionalProperties": true
              }
            },
            "required": [
              "adaptive"
            ],
            "additionalProperties": true
          }
        ],
        "default": "adaptive",
        "x-newrelic-sampler": true,
        "description": "Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_REMOTE_PARENT_SAMPLED": {
      "pathSegments": [
        "distributed_tracing",
        "sampler",
        "remote_parent_sampled"
      ],
      "node": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "always_on",
              "always_off",
              "adaptive"
            ]
          },
          {
            "type": "object",
            "properties": {
              "trace_id_ratio_based": {
                "type": "object",
                "properties": {
                  "ratio": {
                    "type": "number"
                  }
                },
                "required": [
                  "ratio"
                ],
                "additionalProperties": true
              }
            },
            "required": [
              "trace_id_ratio_based"
            ],
            "additionalProperties": true
          },
          {
            "type": "object",
            "properties": {
              "adaptive": {
                "type": "object",
                "properties": {
                  "sampling_target": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 120
                  }
                },
                "additionalProperties": true
              }
            },
            "required": [
              "adaptive"
            ],
            "additionalProperties": true
          }
        ],
        "default": "adaptive",
        "x-newrelic-sampler": true,
        "description": "When set to `always_on`, the sampled flag in the `traceparent` header being set to \"true\" will result in the local transaction being sampled with a priority value of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting."
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_REMOTE_PARENT_NOT_SAMPLED": {
      "pathSegments": [
        "distributed_tracing",
        "sampler",
        "remote_parent_not_sampled"
      ],
      "node": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "always_on",
              "always_off",
              "adaptive"
            ]
          },
          {
            "type": "object",
            "properties": {
              "trace_id_ratio_based": {
                "type": "object",
                "properties": {
                  "ratio": {
                    "type": "number"
                  }
                },
                "required": [
                  "ratio"
                ],
                "additionalProperties": true
              }
            },
            "required": [
              "trace_id_ratio_based"
            ],
            "additionalProperties": true
          },
          {
            "type": "object",
            "properties": {
              "adaptive": {
                "type": "object",
                "properties": {
                  "sampling_target": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 120
                  }
                },
                "additionalProperties": true
              }
            },
            "required": [
              "adaptive"
            ],
            "additionalProperties": true
          }
        ],
        "default": "adaptive",
        "x-newrelic-sampler": true,
        "description": "When set to `always_on`, the local transaction will be sampled with a priority of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0."
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_ADAPTIVE_SAMPLING_TARGET": {
      "pathSegments": [
        "distributed_tracing",
        "sampler",
        "adaptive_sampling_target"
      ],
      "node": {
        "type": "integer",
        "default": 10,
        "minimum": 1,
        "maximum": 120,
        "description": "The sampling target for adaptive sampling is controlled via this attribute when configuring the default/adaptive sampler. The default sampling target is 10 transactions/min when it is not specified but **MUST** be within the range of [1, 120] (inclusive). Upon agent connect, the connect response **MUST** provide the value of `sampling_target` based on this configuration setting's value. The `sampling_target` value from the connect response **SHOULD** be used as the sampling target value for adaptive sampling in the agent."
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_FULL_GRANULARITY_ENABLED": {
      "pathSegments": [
        "distributed_tracing",
        "sampler",
        "full_granularity",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_PARTIAL_GRANULARITY_ENABLED": {
      "pathSegments": [
        "distributed_tracing",
        "sampler",
        "partial_granularity",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_PARTIAL_GRANULARITY_TYPE": {
      "pathSegments": [
        "distributed_tracing",
        "sampler",
        "partial_granularity",
        "type"
      ],
      "node": {
        "x-newrelic-coerce": "allowList",
        "type": "string",
        "enum": [
          "compact",
          "essential",
          "reduced"
        ],
        "default": "essential"
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_PARTIAL_GRANULARITY_ROOT": {
      "pathSegments": [
        "distributed_tracing",
        "sampler",
        "partial_granularity",
        "root"
      ],
      "node": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "always_on",
              "always_off",
              "adaptive"
            ]
          },
          {
            "type": "object",
            "properties": {
              "trace_id_ratio_based": {
                "type": "object",
                "properties": {
                  "ratio": {
                    "type": "number"
                  }
                },
                "required": [
                  "ratio"
                ],
                "additionalProperties": true
              }
            },
            "required": [
              "trace_id_ratio_based"
            ],
            "additionalProperties": true
          },
          {
            "type": "object",
            "properties": {
              "adaptive": {
                "type": "object",
                "properties": {
                  "sampling_target": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 120
                  }
                },
                "additionalProperties": true
              }
            },
            "required": [
              "adaptive"
            ],
            "additionalProperties": true
          }
        ],
        "default": "adaptive",
        "x-newrelic-sampler": true,
        "description": "Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_PARTIAL_GRANULARITY_REMOTE_PARENT_SAMPLED": {
      "pathSegments": [
        "distributed_tracing",
        "sampler",
        "partial_granularity",
        "remote_parent_sampled"
      ],
      "node": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "always_on",
              "always_off",
              "adaptive"
            ]
          },
          {
            "type": "object",
            "properties": {
              "trace_id_ratio_based": {
                "type": "object",
                "properties": {
                  "ratio": {
                    "type": "number"
                  }
                },
                "required": [
                  "ratio"
                ],
                "additionalProperties": true
              }
            },
            "required": [
              "trace_id_ratio_based"
            ],
            "additionalProperties": true
          },
          {
            "type": "object",
            "properties": {
              "adaptive": {
                "type": "object",
                "properties": {
                  "sampling_target": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 120
                  }
                },
                "additionalProperties": true
              }
            },
            "required": [
              "adaptive"
            ],
            "additionalProperties": true
          }
        ],
        "default": "adaptive",
        "x-newrelic-sampler": true,
        "description": "When set to `always_on`, the sampled flag in the `traceparent` header being set to \"true\" will result in the local transaction being sampled with a priority value of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting."
      }
    },
    "NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_PARTIAL_GRANULARITY_REMOTE_PARENT_NOT_SAMPLED": {
      "pathSegments": [
        "distributed_tracing",
        "sampler",
        "partial_granularity",
        "remote_parent_not_sampled"
      ],
      "node": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "always_on",
              "always_off",
              "adaptive"
            ]
          },
          {
            "type": "object",
            "properties": {
              "trace_id_ratio_based": {
                "type": "object",
                "properties": {
                  "ratio": {
                    "type": "number"
                  }
                },
                "required": [
                  "ratio"
                ],
                "additionalProperties": true
              }
            },
            "required": [
              "trace_id_ratio_based"
            ],
            "additionalProperties": true
          },
          {
            "type": "object",
            "properties": {
              "adaptive": {
                "type": "object",
                "properties": {
                  "sampling_target": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 120
                  }
                },
                "additionalProperties": true
              }
            },
            "required": [
              "adaptive"
            ],
            "additionalProperties": true
          }
        ],
        "default": "adaptive",
        "x-newrelic-sampler": true,
        "description": "When set to `always_on`, the local transaction will be sampled with a priority of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0."
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_ATTRIBUTES_ENABLED": {
      "pathSegments": [
        "error_collector",
        "attributes",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "If `true`, the agent captures attributes from error collection."
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_ATTRIBUTES_EXCLUDE": {
      "pathSegments": [
        "error_collector",
        "attributes",
        "exclude"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to exclude from error collection. Allows * as wildcard at end."
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_ATTRIBUTES_INCLUDE": {
      "pathSegments": [
        "error_collector",
        "attributes",
        "include"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to include in error collection. Allows * as wildcard at end."
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_ENABLED": {
      "pathSegments": [
        "error_collector",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Disabling the error tracer just means that errors aren't collected and sent to New Relic -- it DOES NOT remove any instrumentation."
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES": {
      "pathSegments": [
        "error_collector",
        "ignore_status_codes"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES",
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [
          404
        ],
        "description": "List of HTTP error status codes the error tracer should disregard. Ignoring a status code means that the transaction is not renamed to match the code, and the request is not treated as an error by the error collector. NOTE: This configuration value has no effect on errors recorded using `noticeError()`. Defaults to 404 NOT FOUND."
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_CAPTURE_EVENTS": {
      "pathSegments": [
        "error_collector",
        "capture_events"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether error events are collected."
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_MAX_EVENT_SAMPLES_STORED": {
      "pathSegments": [
        "error_collector",
        "max_event_samples_stored"
      ],
      "node": {
        "type": "integer",
        "default": 100,
        "description": "The agent will collect all error events up to this number per minute. If there are more than that, a statistical sampling will be collected. Currently this uses a priority sampling algorithm. By increasing this setting you are both increasing the memory requirements of the agent as well as increasing the payload to the New Relic servers. The memory concerns are something you should consider for your own server's sake. The payload of events is compressed, but if it grows too large the New Relic servers may reject it."
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERRORS": {
      "pathSegments": [
        "error_collector",
        "expected_classes"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERRORS",
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": []
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_EXPECTED_MESSAGES": {
      "pathSegments": [
        "error_collector",
        "expected_messages"
      ],
      "node": {
        "x-newrelic-coerce": "object",
        "type": "object",
        "additionalProperties": true,
        "default": {}
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES": {
      "pathSegments": [
        "error_collector",
        "expected_status_codes"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES",
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": []
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERRORS": {
      "pathSegments": [
        "error_collector",
        "ignore_classes"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERRORS",
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": []
      }
    },
    "NEW_RELIC_ERROR_COLLECTOR_IGNORE_MESSAGES": {
      "pathSegments": [
        "error_collector",
        "ignore_messages"
      ],
      "node": {
        "x-newrelic-coerce": "object",
        "type": "object",
        "additionalProperties": true,
        "default": {}
      }
    },
    "NEW_RELIC_GRPC_RECORD_ERRORS": {
      "pathSegments": [
        "grpc",
        "record_errors"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Enables recording of non-zero gRPC status codes. Default is `true`."
      }
    },
    "NEW_RELIC_GRPC_IGNORE_STATUS_CODES": {
      "pathSegments": [
        "grpc",
        "ignore_status_codes"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "List of gRPC error status codes the error tracer should disregard. Ignoring a status code means that the transaction is not renamed to match the code, and the request is not treated as an error by the error collector. NOTE: This configuration value has no effect on errors recorded using `noticeError()`. Defaults to no codes ignored."
      }
    },
    "NEW_RELIC_HEROKU_USE_DYNO_NAMES": {
      "pathSegments": [
        "heroku",
        "use_dyno_names"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_INFINITE_TRACING_TRACE_OBSERVER_HOST": {
      "pathSegments": [
        "infinite_tracing",
        "trace_observer",
        "host"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "The URI HOST of the observer. Setting this enables infinite tracing."
      }
    },
    "NEW_RELIC_INFINITE_TRACING_TRACE_OBSERVER_PORT": {
      "pathSegments": [
        "infinite_tracing",
        "trace_observer",
        "port"
      ],
      "node": {
        "type": "integer",
        "default": 443,
        "description": "The URI PORT of the observer."
      }
    },
    "NEW_RELIC_INFINITE_TRACING_TRACE_OBSERVER_INSECURE": {
      "pathSegments": [
        "infinite_tracing",
        "trace_observer",
        "insecure"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "x-newrelic-internal": true,
        "description": "Whether to connect to the trace observer without TLS. Internal use only."
      }
    },
    "NEW_RELIC_INFINITE_TRACING_SPAN_EVENTS_QUEUE_SIZE": {
      "pathSegments": [
        "infinite_tracing",
        "span_events",
        "queue_size"
      ],
      "node": {
        "type": "integer",
        "default": 10000,
        "description": "The amount of spans to hold onto before dropping them"
      }
    },
    "NEW_RELIC_INFINITE_TRACING_SPAN_EVENTS_BATCH_SIZE": {
      "pathSegments": [
        "infinite_tracing",
        "span_events",
        "batch_size"
      ],
      "node": {
        "type": "integer",
        "default": 750,
        "description": "Size of batches to post to 8T server"
      }
    },
    "NEW_RELIC_INFINITE_TRACING_BATCHING": {
      "pathSegments": [
        "infinite_tracing",
        "batching"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_INFINITE_TRACING_COMPRESSION": {
      "pathSegments": [
        "infinite_tracing",
        "compression"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@ANTHROPIC-AI/SDK_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@anthropic-ai/sdk",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@APOLLO/SERVER_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@apollo/server",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@AWS-SDK/SMITHY-CLIENT_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@aws-sdk/smithy-client",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@AZURE/FUNCTIONS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@azure/functions",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@ELASTIC/ELASTICSEARCH_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@elastic/elasticsearch",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@ELASTIC/TRANSPORT_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@elastic/transport",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@GOOGLE/ADK_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@google/adk",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@GOOGLE/GENAI_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@google/genai",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@GRPC/GRPC-JS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@grpc/grpc-js",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@HAPI/HAPI_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@hapi/hapi",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@HAPI/VISION_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@hapi/vision",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@LANGCHAIN/CORE_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@langchain/core",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@LANGCHAIN/LANGGRAPH_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@langchain/langgraph",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@MODELCONTEXTPROTOCOL/SDK_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@modelcontextprotocol/sdk",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@MODELCONTEXTPROTOCOL/SDK/CLIENT/INDEX.JS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@modelcontextprotocol/sdk/client/index.js",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@NESTJS/CORE_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@nestjs/core",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@NODE-REDIS/CLIENT_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@node-redis/client",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@OPENSEARCH-PROJECT/OPENSEARCH_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@opensearch-project/opensearch",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@PRISMA/CLIENT_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@prisma/client",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@REDIS/CLIENT_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@redis/client",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@SMITHY/CORE_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@smithy/core",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_@SMITHY/SMITHY-CLIENT_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "@smithy/smithy-client",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_AMQPLIB_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "amqplib",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_AMQPLIB/CALLBACK_API_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "amqplib/callback_api",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_AWS-SDK_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "aws-sdk",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_BLUEBIRD_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "bluebird",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_BUNYAN_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "bunyan",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_CASSANDRA-DRIVER_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "cassandra-driver",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_CHILD_PROCESS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "child_process",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_CONNECT_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "connect",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_CRYPTO_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "crypto",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_DNS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "dns",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_EXPRESS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "express",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_FASTIFY_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "fastify",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_FS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "fs",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_HTTP_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "http",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_HTTP2_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "http2",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_HTTPS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "https",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_IOREDIS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "ioredis",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_IOVALKEY_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "iovalkey",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_KAFKAJS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "kafkajs",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_KOA_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "koa",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_MEMCACHED_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "memcached",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_MONGODB_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "mongodb",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_MYSQL_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "mysql",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_MYSQL2_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "mysql2",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_NET_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "net",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_NEXT_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "next",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_OPENAI_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "openai",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_PG_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "pg",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_PINO_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "pino",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_Q_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "q",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_REDIS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "redis",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_RESTIFY_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "restify",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_ROUTER_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "router",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_UNDICI_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "undici",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_WHEN_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "when",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_WINSTON_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "winston",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_INSTRUMENTATION_ZLIB_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "zlib",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether instrumentation for this module is active."
      }
    },
    "NEW_RELIC_KAFKA_METRICS_CLUSTER_METRICS_ENABLED": {
      "pathSegments": [
        "kafka",
        "metrics",
        "cluster",
        "metrics",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Enables capture of the `MessageBroker/Kafka/Cluster/{cluster_id}/{Produce|Consume}/{topic_name}` metrics. Disabled by default."
      }
    },
    "NEW_RELIC_LOG_LEVEL": {
      "pathSegments": [
        "logging",
        "level"
      ],
      "node": {
        "type": "string",
        "default": "info",
        "description": "Verbosity of the module's logging. This module uses bunyan (https://github.com/trentm/node-bunyan) for its logging, and as such the valid logging levels are 'fatal', 'error', 'warn', 'info', 'debug' and 'trace'. Logging at levels 'info' and higher is very terse. For support requests, attaching logs captured at 'trace' level are extremely helpful in chasing down bugs.",
        "x-newrelic-env-var": "NEW_RELIC_LOG_LEVEL"
      }
    },
    "NEW_RELIC_LOG": {
      "pathSegments": [
        "logging",
        "filepath"
      ],
      "node": {
        "type": "string",
        "description": "Where to put the log file -- by default just uses process.cwd + 'newrelic_agent.log'. A special case is a filepath of 'stdout', in which case all logging will go to stdout, or 'stderr', in which case all logging will go to stderr.",
        "x-newrelic-env-var": "NEW_RELIC_LOG"
      }
    },
    "NEW_RELIC_LOG_ENABLED": {
      "pathSegments": [
        "logging",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Whether to write to a log file at all",
        "x-newrelic-env-var": "NEW_RELIC_LOG_ENABLED"
      }
    },
    "NEW_RELIC_LOGGING_DIAGNOSTICS": {
      "pathSegments": [
        "logging",
        "diagnostics"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "x-newrelic-internal": true,
        "description": "Whether to enable internal agent diagnostics logging."
      }
    },
    "NEW_RELIC_MESSAGE_TRACER_SEGMENT_PARAMETERS_ENABLED": {
      "pathSegments": [
        "message_tracer",
        "segment_parameters",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_OPENTELEMETRY_ENABLED": {
      "pathSegments": [
        "opentelemetry",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Global switch for the whole OpenTelemetry feature. If it is set to `false`, any other sub-feature, e.g. `traces`, will not be enabled regardless of that specific sub-feature setting."
      }
    },
    "NEW_RELIC_OPENTELEMETRY_TRACES_ENABLED": {
      "pathSegments": [
        "opentelemetry",
        "traces",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_OPENTELEMETRY_LOGS_ENABLED": {
      "pathSegments": [
        "opentelemetry",
        "logs",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_OPENTELEMETRY_METRICS_ENABLED": {
      "pathSegments": [
        "opentelemetry",
        "metrics",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_OPENTELEMETRY_METRICS_EXPORT_INTERVAL": {
      "pathSegments": [
        "opentelemetry",
        "metrics",
        "export_interval"
      ],
      "node": {
        "type": "integer",
        "default": 60000,
        "description": "`export_interval` defines the number of milliseconds between each attempt to ship metrics to New Relic. This value must be equal to or greater than the value of `export_timeout`."
      }
    },
    "NEW_RELIC_OPENTELEMETRY_METRICS_EXPORT_TIMEOUT": {
      "pathSegments": [
        "opentelemetry",
        "metrics",
        "export_timeout"
      ],
      "node": {
        "type": "integer",
        "default": 10000,
        "description": "`export_timeout` defines the number of milliseconds an export operation is allowed in order to successfully complete. If the timeout is exceeded, it will be reported via the OpenTelemetry diagnostics API."
      }
    },
    "NEW_RELIC_NATIVE_METRICS_ENABLED": {
      "pathSegments": [
        "plugins",
        "native_metrics",
        "enabled"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_NATIVE_METRICS_ENABLED",
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_PROCESS_HOST_DISPLAY_NAME": {
      "pathSegments": [
        "process_host",
        "display_name"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "Configurable display name for hosts"
      }
    },
    "NEW_RELIC_IPV_PREFERENCE": {
      "pathSegments": [
        "process_host",
        "ipv_preference"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_IPV_PREFERENCE",
        "x-newrelic-coerce": "allowList",
        "type": "string",
        "enum": [
          "4",
          "6"
        ],
        "default": "4",
        "description": "ip address preference when creating hostnames"
      }
    },
    "NEW_RELIC_PROFILING_ENABLED": {
      "pathSegments": [
        "profiling",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_PROFILING_INCLUDE": {
      "pathSegments": [
        "profiling",
        "include"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [
          "cpu",
          "heap"
        ],
        "description": "List of profile type names to enable. Only cpu and heap profiles are currently supported"
      }
    },
    "NEW_RELIC_PROFILING_DELAY": {
      "pathSegments": [
        "profiling",
        "delay"
      ],
      "node": {
        "type": "integer",
        "default": 0,
        "description": "Delay in milliseconds before starting profiler."
      }
    },
    "NEW_RELIC_PROFILING_DURATION": {
      "pathSegments": [
        "profiling",
        "duration"
      ],
      "node": {
        "type": "integer",
        "default": 0,
        "description": "If >0, stop profiler after this many milliseconds of operation."
      }
    },
    "NEW_RELIC_PROFILING_SOURCE_MAPPING_ENABLED": {
      "pathSegments": [
        "profiling",
        "source_mapping",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "When set to `true`, resolves profiler frames to their original source files/lines using source maps, instead of the compiled output."
      }
    },
    "NEW_RELIC_PROFILING_SAMPLE_INTERVAL": {
      "pathSegments": [
        "profiling",
        "sample_interval"
      ],
      "node": {
        "type": "integer",
        "default": 100,
        "description": "The interval in milliseconds at which to harvest and ingest profile data."
      }
    },
    "NEW_RELIC_NAMING_RULES": {
      "pathSegments": [
        "rules",
        "name"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_NAMING_RULES",
        "x-newrelic-coerce": "objectList",
        "type": "array",
        "items": {},
        "default": [],
        "description": "A list of rules of the format {pattern: 'pattern', name: 'name'} for matching incoming request URLs and naming the associated New Relic transactions. Both pattern and name are required. Additional attributes are ignored. Patterns may have capture groups (following JavaScript conventions), and names will use $1-style replacement strings. See the documentation for addNamingRule for important caveats."
      }
    },
    "NEW_RELIC_IGNORING_RULES": {
      "pathSegments": [
        "rules",
        "ignore"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_IGNORING_RULES",
        "type": "array",
        "items": {
          "type": [
            "string",
            "object"
          ]
        },
        "default": [
          "^/socket.io/.*/xhr-polling/"
        ],
        "description": "A list of patterns for matching incoming request URLs to be ignored by the agent. Patterns may be strings or regular expressions. By default, socket.io long-polling is ignored. env NEW_RELIC_IGNORING_RULES"
      }
    },
    "NEW_RELIC_SECURITY_ENABLED": {
      "pathSegments": [
        "security",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Toggles the generation of security events by the security agent."
      }
    },
    "NEW_RELIC_SECURITY_AGENT_ENABLED": {
      "pathSegments": [
        "security",
        "agent",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SECURITY_MODE": {
      "pathSegments": [
        "security",
        "mode"
      ],
      "node": {
        "x-newrelic-coerce": "allowList",
        "type": "string",
        "enum": [
          "IAST",
          "RASP"
        ],
        "default": "IAST",
        "description": "Security agent provides two modes: IAST and RASP. Default is IAST."
      }
    },
    "NEW_RELIC_SECURITY_VALIDATOR_SERVICE_URL": {
      "pathSegments": [
        "security",
        "validator_service_url"
      ],
      "node": {
        "type": "string",
        "default": "wss://csec.nr-data.net",
        "description": "Security agent validator URL. Must be prefixed with wss://."
      }
    },
    "NEW_RELIC_SECURITY_DETECTION_RCI_ENABLED": {
      "pathSegments": [
        "security",
        "detection",
        "rci",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_SECURITY_DETECTION_RXSS_ENABLED": {
      "pathSegments": [
        "security",
        "detection",
        "rxss",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_SECURITY_DETECTION_DESERIALIZATION_ENABLED": {
      "pathSegments": [
        "security",
        "detection",
        "deserialization",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true
      }
    },
    "NEW_RELIC_SECURITY_IAST_TEST_IDENTIFIER": {
      "pathSegments": [
        "security",
        "iast_test_identifier"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "Unique test identifier when running IAST with CI/CD"
      }
    },
    "NEW_RELIC_SECURITY_SCAN_CONTROLLERS_IAST_SCAN_REQUEST_RATE_LIMIT": {
      "pathSegments": [
        "security",
        "scan_controllers",
        "iast_scan_request_rate_limit"
      ],
      "node": {
        "type": "integer",
        "default": 3600,
        "description": "The maximum number of analysis probes or requests that can be sent to the application in one minute."
      }
    },
    "NEW_RELIC_SECURITY_SCAN_CONTROLLERS_SCAN_INSTANCE_COUNT": {
      "pathSegments": [
        "security",
        "scan_controllers",
        "scan_instance_count"
      ],
      "node": {
        "type": "integer",
        "default": 0,
        "description": "The number of application instances for a specific entity where IAST analysis is performed. Values are 0 or 1, 0 signifies run on all application instances"
      }
    },
    "NEW_RELIC_SECURITY_SCAN_SCHEDULE_DELAY": {
      "pathSegments": [
        "security",
        "scan_schedule",
        "delay"
      ],
      "node": {
        "type": "integer",
        "default": 0,
        "description": "The delay field specifies the time in minutes before an IAST scan begins after the application starts"
      }
    },
    "NEW_RELIC_SECURITY_SCAN_SCHEDULE_DURATION": {
      "pathSegments": [
        "security",
        "scan_schedule",
        "duration"
      ],
      "node": {
        "type": "integer",
        "default": 0,
        "description": "The duration field specifies the amount of time in minutes that the IAST scan will run"
      }
    },
    "NEW_RELIC_SECURITY_SCAN_SCHEDULE_SCHEDULE": {
      "pathSegments": [
        "security",
        "scan_schedule",
        "schedule"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "The schedule field specifies a unix cron expression that defines when the IAST scan should run. By default, schedule is disabled"
      }
    },
    "NEW_RELIC_SECURITY_SCAN_SCHEDULE_ALWAYS_SAMPLE_TRACES": {
      "pathSegments": [
        "security",
        "scan_schedule",
        "always_sample_traces"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Allows IAST to actively collect trace data in the background and the security agent will use this collected data to perform an IAST scan at the scheduled time"
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_API": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "api"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Ignore specific APIs from IAST analysis. The regex pattern should provide a full match for the URL without the endpoint."
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_HTTP_REQUEST_PARAMETERS_HEADER": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "http_request_parameters",
        "header"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": []
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_HTTP_REQUEST_PARAMETERS_QUERY": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "http_request_parameters",
        "query"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": []
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_HTTP_REQUEST_PARAMETERS_BODY": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "http_request_parameters",
        "body"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": []
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_INSECURE_SETTINGS": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "iast_detection_category",
        "insecure_settings"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_INVALID_FILE_ACCESS": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "iast_detection_category",
        "invalid_file_access"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_SQL_INJECTION": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "iast_detection_category",
        "sql_injection"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_NOSQL_INJECTION": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "iast_detection_category",
        "nosql_injection"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_LDAP_INJECTION": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "iast_detection_category",
        "ldap_injection"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_JAVASCRIPT_INJECTION": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "iast_detection_category",
        "javascript_injection"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_COMMAND_INJECTION": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "iast_detection_category",
        "command_injection"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_XPATH_INJECTION": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "iast_detection_category",
        "xpath_injection"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_SSRF": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "iast_detection_category",
        "ssrf"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_RXSS": {
      "pathSegments": [
        "security",
        "exclude_from_iast_scan",
        "iast_detection_category",
        "rxss"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    },
    "NEW_RELIC_SERVERLESS_MODE_ENABLED": {
      "pathSegments": [
        "serverless_mode",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Specifies whether the agent will be used to monitor serverless functions (e.g. AWS Lambda). Defaults to true when the AWS_LAMBDA_FUNCTION_NAME environment variable is present, false otherwise."
      }
    },
    "NEW_RELIC_SLOW_SQL_ENABLED": {
      "pathSegments": [
        "slow_sql",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Enables and disables `slow_sql` recording."
      }
    },
    "NEW_RELIC_MAX_SQL_SAMPLES": {
      "pathSegments": [
        "slow_sql",
        "max_samples"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_MAX_SQL_SAMPLES",
        "type": "integer",
        "default": 10,
        "description": "Sets the maximum number of slow query samples that will be collected in a single harvest cycle. env NEW_RELIC_MAX_SQL_SAMPLES"
      }
    },
    "NEW_RELIC_SPAN_EVENTS_ENABLED": {
      "pathSegments": [
        "span_events",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Enables/disables span event generation"
      }
    },
    "NEW_RELIC_SPAN_EVENTS_ATTRIBUTES_ENABLED": {
      "pathSegments": [
        "span_events",
        "attributes",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "If `true`, the agent captures attributes from span events."
      }
    },
    "NEW_RELIC_SPAN_EVENTS_ATTRIBUTES_EXCLUDE": {
      "pathSegments": [
        "span_events",
        "attributes",
        "exclude"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to exclude in span events. Allows * as wildcard at end."
      }
    },
    "NEW_RELIC_SPAN_EVENTS_ATTRIBUTES_INCLUDE": {
      "pathSegments": [
        "span_events",
        "attributes",
        "include"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to include in span events. Allows * as wildcard at end."
      }
    },
    "NEW_RELIC_SPAN_EVENTS_MAX_SAMPLES_STORED": {
      "pathSegments": [
        "span_events",
        "max_samples_stored"
      ],
      "node": {
        "type": "integer",
        "default": 2000,
        "description": "The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected."
      }
    },
    "NEW_RELIC_STRIP_EXCEPTION_MESSAGES_ENABLED": {
      "pathSegments": [
        "strip_exception_messages",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "When `true`, the agent will redact the messages of captured errors."
      }
    },
    "NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_ENABLED": {
      "pathSegments": [
        "transaction_events",
        "attributes",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "If `true`, the agent captures attributes from transaction events."
      }
    },
    "NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_EXCLUDE": {
      "pathSegments": [
        "transaction_events",
        "attributes",
        "exclude"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to exclude in transaction events. Allows * as wildcard at end. env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_EXCLUDE"
      }
    },
    "NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_INCLUDE": {
      "pathSegments": [
        "transaction_events",
        "attributes",
        "include"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to include in transaction events. Allows * as wildcard at end. env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_INCLUDE"
      }
    },
    "NEW_RELIC_TRANSACTION_EVENTS_ENABLED": {
      "pathSegments": [
        "transaction_events",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "If this is disabled, the agent does not collect, nor try to send, analytic data."
      }
    },
    "NEW_RELIC_TRANSACTION_EVENTS_MAX_SAMPLES_STORED": {
      "pathSegments": [
        "transaction_events",
        "max_samples_stored"
      ],
      "node": {
        "type": "integer",
        "default": 10000,
        "description": "The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected."
      }
    },
    "NEW_RELIC_TRANSACTION_SEGMENTS_ATTRIBUTES_ENABLED": {
      "pathSegments": [
        "transaction_segments",
        "attributes",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "If `true`, the agent captures attributes from transaction segments."
      }
    },
    "NEW_RELIC_TRANSACTION_SEGMENTS_ATTRIBUTES_EXCLUDE": {
      "pathSegments": [
        "transaction_segments",
        "attributes",
        "exclude"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to exclude in transaction segments. Allows * as wildcard at end."
      }
    },
    "NEW_RELIC_TRANSACTION_SEGMENTS_ATTRIBUTES_INCLUDE": {
      "pathSegments": [
        "transaction_segments",
        "attributes",
        "include"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to include in transaction segments. Allows * as wildcard at end."
      }
    },
    "NEW_RELIC_TRANSACTION_TRACER_ATTRIBUTES_ENABLED": {
      "pathSegments": [
        "transaction_tracer",
        "attributes",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "If `true`, the agent captures attributes from transaction traces."
      }
    },
    "NEW_RELIC_TRANSACTION_TRACER_ATTRIBUTES_EXCLUDE": {
      "pathSegments": [
        "transaction_tracer",
        "attributes",
        "exclude"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to exclude from transaction traces. Allows * as wildcard at end."
      }
    },
    "NEW_RELIC_TRANSACTION_TRACER_ATTRIBUTES_INCLUDE": {
      "pathSegments": [
        "transaction_tracer",
        "attributes",
        "include"
      ],
      "node": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "description": "Prefix of attributes to include in transaction traces. Allows * as wildcard at end."
      }
    },
    "NEW_RELIC_TRACER_ENABLED": {
      "pathSegments": [
        "transaction_tracer",
        "enabled"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_TRACER_ENABLED",
        "type": "boolean",
        "default": true,
        "description": "Whether to collect & submit slow transaction traces to New Relic. The instrumentation is loaded regardless of this setting, as it's necessary to gather metrics. Disable the agent to prevent the instrumentation from loading."
      }
    },
    "NEW_RELIC_TRACER_THRESHOLD": {
      "pathSegments": [
        "transaction_tracer",
        "transaction_threshold"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_TRACER_THRESHOLD",
        "x-newrelic-coerce": "numericOrString",
        "type": [
          "number",
          "string"
        ],
        "default": "apdex_f",
        "description": "Sets the time, in seconds, for a transaction to be considered slow. When a transaction exceeds this threshold, a transaction trace will be recorded. When set to 'apdex_f', the threshold will be set to 4 * apdex_t, which with a default apdex_t value of 500 milliseconds will be 2 seconds. If a number is provided, it is set in seconds."
      }
    },
    "NEW_RELIC_TRACER_TOP_N": {
      "pathSegments": [
        "transaction_tracer",
        "top_n"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_TRACER_TOP_N",
        "type": "integer",
        "default": 20,
        "description": "Increase this parameter to increase the diversity of the slow transaction traces recorded by your application over time. Confused? Read on. Transactions are named based on the request (see the README for the details of how requests are mapped to transactions), and top_n refers to the \"top n slowest transactions\" grouped by these names. The module will only replace a recorded trace with a new trace if the new trace is slower than the previous slowest trace of that name. The default value for this setting is 20, as the transaction trace view page also defaults to showing the 20 slowest transactions. If you want to record the absolute slowest transaction over the last minute, set top_n to 0 or 1. This used to be the default, and has a problem in that it will allow one very slow route to dominate your slow transaction traces. The module will always record at least 5 different slow transactions in the reporting periods after it starts up, and will reset its internal slow trace aggregator if no slow transactions have been recorded for the last 5 harvest cycles, restarting the aggregation process. env NEW_RELIC_TRACER_TOP_N"
      }
    },
    "NEW_RELIC_RECORD_SQL": {
      "pathSegments": [
        "transaction_tracer",
        "record_sql"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_RECORD_SQL",
        "x-newrelic-coerce": "allowList",
        "type": "string",
        "enum": [
          "off",
          "obfuscated",
          "raw"
        ],
        "default": "obfuscated",
        "description": "This option affects both slow-queries and record_sql for transaction traces. It can have one of 3 values: 'off', 'obfuscated' or 'raw' When it is 'off' no slow queries will be captured, and backtraces and sql will not be included in transaction traces. If it is 'raw' or 'obfuscated' and other criteria (slow_sql.enabled etc) are met for a query. The raw or obfuscated sql will be included in the transaction trace and a slow query sample will be collected."
      }
    },
    "NEW_RELIC_EXPLAIN_THRESHOLD": {
      "pathSegments": [
        "transaction_tracer",
        "explain_threshold"
      ],
      "node": {
        "x-newrelic-env-var": "NEW_RELIC_EXPLAIN_THRESHOLD",
        "type": "integer",
        "default": 500,
        "description": "This option affects both slow-queries and record_sql for transaction traces. This is the minimum duration a query must take (in ms) for it to be considered for for slow query and inclusion in transaction traces."
      }
    },
    "NEW_RELIC_URL_OBFUSCATION_ENABLED": {
      "pathSegments": [
        "url_obfuscation",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "Toggles whether to obfuscate URL parameters"
      }
    },
    "NEW_RELIC_URL_OBFUSCATION_REGEX_PATTERN": {
      "pathSegments": [
        "url_obfuscation",
        "regex",
        "pattern"
      ],
      "node": {
        "x-newrelic-coerce": "regex",
        "type": "string",
        "description": "Must be a valid regular expression.",
        "default": null
      }
    },
    "NEW_RELIC_URL_OBFUSCATION_REGEX_FLAGS": {
      "pathSegments": [
        "url_obfuscation",
        "regex",
        "flags"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "A string containing RegEx flags to use when matching URL parameters"
      }
    },
    "NEW_RELIC_URL_OBFUSCATION_REGEX_REPLACEMENT": {
      "pathSegments": [
        "url_obfuscation",
        "regex",
        "replacement"
      ],
      "node": {
        "type": "string",
        "default": "",
        "description": "A string containing a replacement value for URL parameters can contain references to capture groups in the pattern"
      }
    },
    "NEW_RELIC_UTILIZATION_DETECT_AWS": {
      "pathSegments": [
        "utilization",
        "detect_aws"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "This flag dictates whether the agent attempts to reach out to AWS to get info about the vm the process is running on."
      }
    },
    "NEW_RELIC_UTILIZATION_DETECT_PCF": {
      "pathSegments": [
        "utilization",
        "detect_pcf"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "This flag dictates whether the agent attempts to detect if the the process is running on Pivotal Cloud Foundry."
      }
    },
    "NEW_RELIC_UTILIZATION_DETECT_AZURE": {
      "pathSegments": [
        "utilization",
        "detect_azure"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "This flag dictates whether the agent attempts to reach out to Azure to get info about the vm the process is running on."
      }
    },
    "NEW_RELIC_UTILIZATION_DETECT_AZUREFUNCTION": {
      "pathSegments": [
        "utilization",
        "detect_azurefunction"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "This flag dictates whether the agent attempts to read environment variables and invocation context to get info about the Azure Function called."
      }
    },
    "NEW_RELIC_UTILIZATION_DETECT_DOCKER": {
      "pathSegments": [
        "utilization",
        "detect_docker"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "This flag dictates whether the agent attempts to read files to get info about the container the process is running in. env NEW_RELIC_UTILIZATION_DETECT_DOCKER"
      }
    },
    "NEW_RELIC_UTILIZATION_DETECT_GCP": {
      "pathSegments": [
        "utilization",
        "detect_gcp"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "This flag dictates whether the agent attempts to reach out to GCP to get info about the vm the process is running on."
      }
    },
    "NEW_RELIC_UTILIZATION_DETECT_KUBERNETES": {
      "pathSegments": [
        "utilization",
        "detect_kubernetes"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "This flag dictates whether the agent attempts to reach out to Kubernetes to get info about the container the process is running on."
      }
    },
    "NEW_RELIC_UTILIZATION_LOGICAL_PROCESSORS": {
      "pathSegments": [
        "utilization",
        "logical_processors"
      ],
      "node": {
        "type": "number",
        "default": null
      }
    },
    "NEW_RELIC_UTILIZATION_BILLING_HOSTNAME": {
      "pathSegments": [
        "utilization",
        "billing_hostname"
      ],
      "node": {
        "type": [
          "string",
          "null"
        ],
        "default": null
      }
    },
    "NEW_RELIC_UTILIZATION_TOTAL_RAM_MIB": {
      "pathSegments": [
        "utilization",
        "total_ram_mib"
      ],
      "node": {
        "type": "integer",
        "default": null
      }
    },
    "NEW_RELIC_UTILIZATION_GCP_USE_INSTANCE_AS_HOST": {
      "pathSegments": [
        "utilization",
        "gcp_use_instance_as_host"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "Deprecated and will be removed in v15 of the agent. Please use `utilization.gcp_cloud_run.use_instance_as_host` instead. When enabled, it will use the GCP metadata id to set the hostname of the running application (Services, Worker Pools, and Jobs)."
      }
    },
    "NEW_RELIC_UTILIZATION_GCP_CLOUD_RUN_INCLUDE_REVISION_IN_HOST": {
      "pathSegments": [
        "utilization",
        "gcp_cloud_run",
        "include_revision_in_host"
      ],
      "node": {
        "type": "boolean",
        "default": false,
        "description": "If `true`, the agent prepends the Cloud Run revision name to the GCP instance id to form the hostname (`{revision}-{instance id}`) on Google Cloud Run. The revision name comes from `K_REVISION` on a Cloud Run Service, `CLOUD_RUN_REVISION` on a Cloud Run Worker Pool, and `CLOUD_RUN_EXECUTION` on a Cloud Run Job. Has no effect unless `utilization.gcp_use_instance_as_host` is also `true`."
      }
    },
    "NEW_RELIC_UTILIZATION_GCP_CLOUD_RUN_USE_INSTANCE_AS_HOST": {
      "pathSegments": [
        "utilization",
        "gcp_cloud_run",
        "use_instance_as_host"
      ],
      "node": {
        "type": "boolean",
        "default": true,
        "description": "When enabled, it will use the GCP metadata id to set the hostname of the running application (Services, Worker Pools, and Jobs)."
      }
    },
    "NEW_RELIC_WORKER_THREADS_ENABLED": {
      "pathSegments": [
        "worker_threads",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false
      }
    }
  }
}


const validate = (function () {
  const module = { exports: {} }
  const exports = module.exports
  ;(function (module, exports, require) {
    "use strict";module.exports = validate20;module.exports.default = validate20;const schema31 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"root.js","title":"New Relic Node.js Agent Configuration","description":"Configuration accepted by the New Relic Node.js agent's config file (newrelic.js, newrelic.cjs, or newrelic.mjs), and by the equivalent NEW_RELIC_* environment variables.","type":"object","required":[],"additionalProperties":true,"properties":{"account_id":{"type":["string","number","null"],"default":null,"description":"The New Relic account ID to attribute serverless trace data to. Only used in serverless_mode; required for distributed tracing to be enabled there. Locally configured values are ignored outside serverless_mode."},"agent_enabled":{"x-newrelic-env-var":"NEW_RELIC_ENABLED","type":"boolean","default":true,"description":"Whether the module is enabled."},"allow_all_headers":{"type":"boolean","default":false,"description":"When true, all request headers except for those listed in attributes.exclude will be captured for all traces, unless otherwise specified in a destination's attributes include/exclude lists."},"apdex_t":{"type":"number","default":0.1,"description":"The default Apdex tolerating / threshold value for applications, in seconds. The default for Node is apdexT to 100 milliseconds, which is lower than New Relic standard, but Node.js applications tend to be more latency-sensitive than most. NOTE: This setting can not be modified locally. Use server-side configuration to change your application's apdex."},"apm_lambda_mode":{"type":"boolean","default":false,"description":"When `true`, the AWS Lambda instrumentation will add the necessary data to support the new (as of 2025) unified APM UI."},"app_name":{"oneOf":[{"type":"array","items":{"type":"string"}},{"type":"string"}],"default":[],"description":"Array of application names."},"certificates":{"type":"array","items":{"type":"string"},"default":[],"description":"Custom SSL certificates If your proxy uses a custom SSL certificate, you can add the CA text to this array, one entry per certificate. The easiest way to do this is with `fs.readFileSync` e.g. certificates: [ require('fs').readFileSync('custom.crt', 'utf8') // don't forget the utf8 ]"},"compressed_content_encoding":{"type":"string","default":"gzip","description":"If the data compression threshold is reached in the payload, the agent compresses data, using gzip compression by default. The config option `compressed_content_encoding` can be set to 'deflate' to use deflate compression."},"enforce_backstop":{"type":"boolean","default":true,"description":"By default, any transactions that are not affected by other bits of naming logic (the API, rules, or metric normalization rules) will have their names set to 'NormalizedUri/*'. Setting this value to false will set them instead to Uri/path/to/resource. Don't change this setting unless you understand the implications of New Relic's metric grouping issues and are confident your application isn't going to run afoul of them. Your application could end up getting blocked! Nobody wants that."},"high_security":{"type":"boolean","default":false,"description":"High Security High security mode (v2) is a setting which prevents any sensitive data from being sent to New Relic. The local setting must match the server setting. If there is a mismatch the agent will log a message and act as if it is disabled. Attributes of high security mode (when enabled): requires SSL does not allow capturing of http params does not allow custom params To read more see: https://docs.newrelic.com/docs/subscriptions/high-security"},"host":{"type":"string","default":"","description":"Hostname for the New Relic collector proxy. You shouldn't need to change this."},"ignore_server_configuration":{"x-newrelic-env-var":"NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG","type":"boolean","default":false,"description":"You may want more control over how your agent is configured and want to disallow the use of New Relic's server-side configuration for agents. To do so, set this to true. env NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG"},"labels":{"oneOf":[{"type":"object"},{"type":"string"}],"default":{},"description":"Label names and values applied to the data sent from this agent, as an object or a `;`-delimited `key:value` string. Label names and values are truncated to 255 characters and the set is capped at 64."},"license_key":{"type":"string","default":"","description":"The user's license key. Must be set by per-app configuration file."},"newrelic_home":{"x-newrelic-env-var":"NEW_RELIC_HOME","type":["string","null"],"default":null},"port":{"type":"integer","default":443,"description":"The port on which the collector proxy will be listening. You shouldn't need to change this."},"primary_application_id":{"type":["string","number","null"],"default":null,"description":"The APM application ID to attribute serverless trace data to. Only used in serverless_mode; defaults to 'Unknown' when account_id is set. Locally configured values are ignored outside serverless_mode."},"proxy":{"x-newrelic-env-var":"NEW_RELIC_PROXY_URL","type":"string","default":"","description":"Proxy url A proxy url can be used in place of setting proxy_host, proxy_port, proxy_user, and proxy_pass. e.g. http://user:pass@host:port/ Setting proxy will override other proxy settings."},"proxy_host":{"type":"string","default":"","description":"Proxy host to use to connect to the internet."},"proxy_pass":{"type":"string","default":"","description":"Proxy password when required."},"proxy_port":{"type":"string","default":"","description":"Proxy port to use to connect to the internet."},"proxy_user":{"type":"string","default":"","description":"Proxy user name when required."},"ssl":{"x-newrelic-env-var":"NEW_RELIC_USE_SSL","type":"boolean","const":true,"default":true,"x-newrelic-internal":true,"description":"Whether or not to use SSL to connect to New Relic servers. This can no longer be disabled; the only permitted value is true."},"trusted_account_key":{"type":["string","number","null"],"default":null,"description":"The trusted account key used to validate incoming distributed trace headers. Only used in serverless_mode; defaults to account_id when account_id is set. Locally configured values are ignored outside serverless_mode."},"agent_control":{"$ref":"agent-control.js"},"ai_monitoring":{"$ref":"ai-monitoring.js"},"api":{"$ref":"api.js"},"apollo_server":{"$ref":"apollo-server.js"},"application_logging":{"$ref":"application-logging.js"},"attributes":{"$ref":"attributes.js"},"audit_log":{"$ref":"audit-log.js"},"browser_monitoring":{"$ref":"browser-monitoring.js"},"cloud":{"$ref":"cloud.js"},"code_level_metrics":{"$ref":"code-level-metrics.js"},"custom_insights_events":{"$ref":"custom-insights-events.js"},"datastore_tracer":{"$ref":"datastore-tracer.js"},"distributed_tracing":{"$ref":"distributed-tracing.js"},"error_collector":{"$ref":"error-collector.js"},"grpc":{"$ref":"grpc.js"},"heroku":{"$ref":"heroku.js"},"infinite_tracing":{"$ref":"infinite-tracing.js"},"instrumentation":{"$ref":"instrumentation.js"},"kafka":{"$ref":"kafka.js"},"logging":{"$ref":"logging.js"},"message_tracer":{"$ref":"message-tracer.js"},"opentelemetry":{"$ref":"opentelemetry.js"},"plugins":{"$ref":"plugins.js"},"process_host":{"$ref":"process-host.js"},"profiling":{"$ref":"profiling.js"},"rules":{"$ref":"rules.js"},"security":{"$ref":"security.js"},"serverless_mode":{"$ref":"serverless-mode.js"},"slow_sql":{"$ref":"slow-sql.js"},"span_events":{"$ref":"span-events.js"},"strip_exception_messages":{"$ref":"strip-exception-messages.js"},"transaction_events":{"$ref":"transaction-events.js"},"transaction_segments":{"$ref":"transaction-segments.js"},"transaction_tracer":{"$ref":"transaction-tracer.js"},"url_obfuscation":{"$ref":"url-obfuscation.js"},"utilization":{"$ref":"utilization.js"},"worker_threads":{"$ref":"worker-threads.js"}}};const schema32 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"agent-control.js","type":"object","x-newrelic-internal":true,"properties":{"enabled":{"type":"boolean","default":false,"description":"Indicates that the agent is being managed by Agent Control. Must be set to true for health monitoring."},"health":{"type":"object","properties":{"delivery_location":{"type":"string","default":"file:///newrelic/apm/health","description":"A string file path to a directory that the agent is expected to write health status files to. Must be set for health monitoring to be enabled."},"frequency":{"type":"integer","default":5,"description":"An integer representing how often the agent should write to the health status file(s), in seconds."}},"additionalProperties":true}},"additionalProperties":true,"description":"Settings for integration with Agent Control. Set by Agent Control, not user-facing."};const schema33 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"ai-monitoring.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Toggles the generation of AI monitoring events by the agent."},"record_content":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true,"description":"When enabled, the content of LLM messages will be included in the recorded spans (i.e. delivered to the New Relic collector). This is enabled by default."},"streaming":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true,"description":"Toggles the capturing of Llm events when using streaming based methods in AIM supported libraries(i.e.- openai, AWS bedrock, langchain)"}},"additionalProperties":true,"description":"When enabled, instrumentation of supported AI libraries will be in effect."};const schema34 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"api.js","type":"object","properties":{"custom_attributes_enabled":{"x-newrelic-env-var":"NEW_RELIC_API_CUSTOM_ATTRIBUTES","type":"boolean","default":true,"description":"Controls for the `API.addCustomAttribute` method."},"custom_events_enabled":{"x-newrelic-env-var":"NEW_RELIC_API_CUSTOM_EVENTS","type":"boolean","default":true,"description":"Controls for the `API.recordCustomEvent` method."},"notice_error_enabled":{"x-newrelic-env-var":"NEW_RELIC_API_NOTICE_ERROR","type":"boolean","default":true,"description":"Controls for the `API.noticeError` method."}},"additionalProperties":true,"description":"API Configuration Some API end points can be turned off via configuration settings to allow for more flexible security options. All API configuration options are disabled when high-security mode is enabled."};const schema35 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"apollo-server.js","type":"object","properties":{"scalars":{"type":"boolean","default":false,"description":"Enable capture of timing of fields resolved with the GraphQLScalarType return type. This may be desired when performing time intensive calculations to return a scalar value. This is not recommended for queries that return a large number of pre-calculated scalar fields. NOTE: query/mutation resolvers will always be captured even if returning a scalar type."},"introspection_queries":{"type":"boolean","default":false,"description":"Enable capture of timings for an [IntrospectionQuery](https://www.graphql-js.org/api-v16/utilities/#introspectionquery)"},"service_definition_queries":{"type":"boolean","default":false,"description":"Enable capture of timings for a [Service Definition query](https://www.apollographql.com/docs/federation/federation-spec/#fetch-service-capabilities) received from an Apollo Federated Gateway Server."},"health_check_queries":{"type":"boolean","default":false,"description":"Enable capture of timings for a [Health Check query](https://www.apollographql.com/docs/federation/api/apollo-gateway/#servicehealthcheck) received from an Apollo Federated Gateway Server."},"field_metrics":{"type":"boolean","default":false,"description":"Enable capture of metrics for every field and resolver argument seen for an Apollo query. This is intended to be used to check for any unused fields in your graphql schema."},"collapse_field_metrics":{"type":"boolean","default":false,"description":"When `field_metrics` is enabled, report list arguments under one metric name without item indexes (for example `ids` instead of `ids.0`, `ids.1`). Each list item still increments the call count of that metric."}},"additionalProperties":true,"description":"Stanza for customizing behavior for apollo server instrumentation"};const schema36 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"application-logging.js","type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"Toggles the ability for all application logging features to be enabled."},"forwarding":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"Toggles whether the agent gathers log records for sending to New Relic."},"max_samples_stored":{"type":"integer","default":10000,"description":"Number of log records to send per minute to New Relic."},"labels":{"type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"If `true`, the agent attaches labels to log records."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"A case-insensitive array containing the labels to exclude from log records."}},"additionalProperties":true}},"additionalProperties":true},"metrics":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"Toggles whether the agent gathers logging metrics."}},"additionalProperties":true},"local_decorating":{"type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Toggles whether the agent performs log decoration on standard log output."}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls the behavior of Logs in Context within agent"};const schema37 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"attributes.js","type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, enables capture of attributes for all destinations. If there are specific parameters you want ignored, use `attributes.exclude`."},"value_size_limit":{"type":"integer","default":256,"maximum":4096,"description":"Defines the number of characters allowed for each individual attribute's value. The default is 256 characters, with a maximum of 4,096."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude from all destinations. Allows * as wildcard at end. NOTE: If excluding headers, they must be in camelCase form to be filtered."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in all destinations. Allows * as wildcard at end. NOTE: If including headers, they must be in camelCase form to be filtered."},"include_enabled":{"type":"boolean","default":true,"description":"If `true`, patterns may be added to the `attributes.include` list."},"filter_cache_limit":{"type":"integer","default":1000,"description":"Controls how many attribute include/exclude rule results are cached by the filter. Increasing this limit will cause greater memory usage and is only necessary if you have an extremely high variety of attributes."}},"additionalProperties":true,"description":"Attributes are key-value pairs containing information that determines the properties of an event or transaction."};const schema38 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"audit-log.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Enables logging of out bound traffic from the Agent to the Collector. This field is ignored if trace level logging is enabled. With trace logging, all traffic is logged."},"endpoints":{"type":"array","items":{"type":"string"},"default":[],"description":"Specify which methods are logged. Used in conjunction with the audit_log flag If audit_log is enabled and this property is empty, all methods will be logged Otherwise, if the audit log is enabled, only the methods specified in the filter will be logged Methods include: error_data, metric_data, and analytic_event_data"}},"additionalProperties":true};const schema39 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"browser-monitoring.js","type":"object","properties":{"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"If `true`, the agent captures attributes from browser monitoring."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude from browser monitoring. Allows * as wildcard at end."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in browser monitoring. Allows * as wildcard at end."}},"additionalProperties":true},"enable":{"x-newrelic-env-var":"NEW_RELIC_BROWSER_MONITOR_ENABLE","type":"boolean","default":true,"description":"Enable browser monitoring header generation. This does not auto-instrument, rather it enables the agent to generate headers. The newrelic module can generate the appropriate <script> header, but you must inject the header yourself, or use a module that does so. This generates the <script>...</script> header necessary for Browser Monitoring This script must be manually injected into your templates, as high as possible in the header, but _after_ any X-UA-COMPATIBLE HTTP-EQUIV meta tags. Otherwise you may hurt IE! This method must be called _during_ a transaction, and must be called every time you want to generate the headers. Do *not* reuse the headers between users, or even between requests."},"debug":{"x-newrelic-env-var":"NEW_RELIC_BROWSER_MONITOR_DEBUG","type":"boolean","default":false,"description":"Request un-minified sources from the server."},"version":{"type":"string","default":"","description":"The browser agent loader version to request, e.g. `\"1.317.0\"`. See the [browser agent EOL policy](https://docs.newrelic.com/docs/browser/browser-monitoring/getting-started/browser-agent-eol-policy/) for which versions are currently available and supported."}},"additionalProperties":true,"description":"Browser Monitoring Browser monitoring lets you correlate transactions between the server and browser giving you accurate data on how long a page request takes, from request, through the server response, up until the actual page render completes."};const schema40 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"cloud.js","type":"object","properties":{"aws":{"type":"object","properties":{"account_id":{"type":"integer","default":null,"description":"The AWS account ID for the AWS account associated with this app."}},"additionalProperties":true}},"additionalProperties":true};const schema41 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"code-level-metrics.js","type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true,"description":"Toggles whether to capture code.* attributes on spans"};const schema42 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"custom-insights-events.js","type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If this is disabled, the agent does not collect, nor try to send, custom event data."},"max_samples_stored":{"type":"integer","default":3000,"description":"The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected. Currently this uses a priority sampling algorithm. By increasing this setting you are both increasing the memory requirements of the agent as well as increasing the payload to the New Relic servers. The memory concerns are something you should consider for your own server's sake. The payload of events is compressed, but if it grows too large the New Relic servers may reject it."}},"additionalProperties":true,"description":"Custom Insights Events Custom insights events are JSON object that are sent to New Relic Insights. You can tell the agent to send your custom events via the `newrelic.recordCustomEvent()` API. These events are sampled once the max queue size is reached. You can tune this setting below. Read more here: http://newrelic.com/insights"};const schema43 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"datastore-tracer.js","type":"object","properties":{"instance_reporting":{"type":"object","properties":{"enabled":{"x-newrelic-env-var":"NEW_RELIC_DATASTORE_INSTANCE_REPORTING_ENABLED","type":"boolean","default":true}},"additionalProperties":true},"database_name_reporting":{"type":"object","properties":{"enabled":{"x-newrelic-env-var":"NEW_RELIC_DATASTORE_DATABASE_NAME_REPORTING_ENABLED","type":"boolean","default":true}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls behavior of datastore instance metrics. Enables reporting the host and port/path/id of database servers. Default is `true`. Enables reporting of database/schema names. Default is `true`."};const schema44 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"distributed-tracing.js","type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"Enables/disables distributed tracing."},"exclude_newrelic_header":{"type":"boolean","default":true,"description":"Excludes New Relic format distributed tracing header (`newrelic`) on outbound requests when set to `true`. By default (when false) both W3C TraceContext (`traceparent`, `tracecontext`) and New Relic formats will be sent."},"sampler":{"type":"object","properties":{"root":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"},"remote_parent_sampled":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"When set to `always_on`, the sampled flag in the `traceparent` header being set to \"true\" will result in the local transaction being sampled with a priority value of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting."},"remote_parent_not_sampled":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"When set to `always_on`, the local transaction will be sampled with a priority of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0."},"adaptive_sampling_target":{"type":"integer","default":10,"minimum":1,"maximum":120,"description":"The sampling target for adaptive sampling is controlled via this attribute when configuring the default/adaptive sampler. The default sampling target is 10 transactions/min when it is not specified but **MUST** be within the range of [1, 120] (inclusive). Upon agent connect, the connect response **MUST** provide the value of `sampling_target` based on this configuration setting's value. The `sampling_target` value from the connect response **SHOULD** be used as the sampling target value for adaptive sampling in the agent."},"full_granularity":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true},"partial_granularity":{"type":"object","properties":{"enabled":{"type":"boolean","default":false},"type":{"x-newrelic-coerce":"allowList","type":"string","enum":["compact","essential","reduced"],"default":"essential"},"root":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"},"remote_parent_sampled":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"When set to `always_on`, the sampled flag in the `traceparent` header being set to \"true\" will result in the local transaction being sampled with a priority value of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting."},"remote_parent_not_sampled":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"When set to `always_on`, the local transaction will be sampled with a priority of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0."}},"additionalProperties":true}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls the method of cross agent tracing in the agent. Distributed tracing lets you see the path that a request takes through your distributed system. Enabling distributed tracing changes the behavior of some New Relic features, so carefully consult the transition guide before you enable this feature: https://docs.newrelic.com/docs/transition-guide-distributed-tracing Default is true."};const schema45 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"error-collector.js","type":"object","properties":{"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, the agent captures attributes from error collection."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude from error collection. Allows * as wildcard at end."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in error collection. Allows * as wildcard at end."}},"additionalProperties":true},"enabled":{"type":"boolean","default":true,"description":"Disabling the error tracer just means that errors aren't collected and sent to New Relic -- it DOES NOT remove any instrumentation."},"ignore_status_codes":{"x-newrelic-env-var":"NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES","type":"array","items":{"type":"string"},"default":[404],"description":"List of HTTP error status codes the error tracer should disregard. Ignoring a status code means that the transaction is not renamed to match the code, and the request is not treated as an error by the error collector. NOTE: This configuration value has no effect on errors recorded using `noticeError()`. Defaults to 404 NOT FOUND."},"capture_events":{"type":"boolean","default":true,"description":"Whether error events are collected."},"max_event_samples_stored":{"type":"integer","default":100,"description":"The agent will collect all error events up to this number per minute. If there are more than that, a statistical sampling will be collected. Currently this uses a priority sampling algorithm. By increasing this setting you are both increasing the memory requirements of the agent as well as increasing the payload to the New Relic servers. The memory concerns are something you should consider for your own server's sake. The payload of events is compressed, but if it grows too large the New Relic servers may reject it."},"expected_classes":{"x-newrelic-env-var":"NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERRORS","type":"array","items":{"type":"string"},"default":[]},"expected_messages":{"x-newrelic-coerce":"object","type":"object","additionalProperties":true,"default":{}},"expected_status_codes":{"x-newrelic-env-var":"NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES","type":"array","items":{"type":"string"},"default":[]},"ignore_classes":{"x-newrelic-env-var":"NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERRORS","type":"array","items":{"type":"string"},"default":[]},"ignore_messages":{"x-newrelic-coerce":"object","type":"object","additionalProperties":true,"default":{}}},"additionalProperties":true,"description":"Whether to collect & submit error traces to New Relic."};const schema46 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"grpc.js","type":"object","properties":{"record_errors":{"type":"boolean","default":true,"description":"Enables recording of non-zero gRPC status codes. Default is `true`."},"ignore_status_codes":{"type":"array","items":{"type":"string"},"default":[],"description":"List of gRPC error status codes the error tracer should disregard. Ignoring a status code means that the transaction is not renamed to match the code, and the request is not treated as an error by the error collector. NOTE: This configuration value has no effect on errors recorded using `noticeError()`. Defaults to no codes ignored."}},"additionalProperties":true,"description":"Controls behavior of gRPC server instrumentation."};const schema47 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"heroku.js","type":"object","properties":{"use_dyno_names":{"type":"boolean","default":true}},"additionalProperties":true,"description":"When enabled, it will use `process.env.DYNO` to set the hostname of the running application"};const schema48 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"infinite-tracing.js","type":"object","properties":{"trace_observer":{"type":"object","properties":{"host":{"type":"string","default":"","description":"The URI HOST of the observer. Setting this enables infinite tracing."},"port":{"type":"integer","default":443,"description":"The URI PORT of the observer."},"insecure":{"type":"boolean","default":false,"x-newrelic-internal":true,"description":"Whether to connect to the trace observer without TLS. Internal use only."}},"additionalProperties":true},"span_events":{"type":"object","properties":{"queue_size":{"type":"integer","default":10000,"description":"The amount of spans to hold onto before dropping them"},"batch_size":{"type":"integer","default":750,"description":"Size of batches to post to 8T server"}},"additionalProperties":true},"batching":{"type":"boolean","default":true},"compression":{"type":"boolean","default":true}},"additionalProperties":true,"description":"Controls the use of infinite tracing."};const schema49 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"instrumentation.js","type":"object","description":"Stanza that contains all keys to disable core & 3rd party package instrumentation(i.e. dns, http, mongodb, pg, redis, etc) **Note**: Disabling a given library may affect the instrumentation of libraries used after the disabled library. Use at your own risk.","additionalProperties":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"properties":{"@anthropic-ai/sdk":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@apollo/server":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@aws-sdk/smithy-client":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@azure/functions":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@elastic/elasticsearch":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@elastic/transport":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@google/adk":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@google/genai":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@grpc/grpc-js":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@hapi/hapi":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@hapi/vision":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@langchain/core":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@langchain/langgraph":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@modelcontextprotocol/sdk":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@modelcontextprotocol/sdk/client/index.js":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@nestjs/core":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@node-redis/client":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@opensearch-project/opensearch":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@prisma/client":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@redis/client":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@smithy/core":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@smithy/smithy-client":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"amqplib":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"amqplib/callback_api":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"aws-sdk":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"bluebird":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"bunyan":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"cassandra-driver":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"child_process":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"connect":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"crypto":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"dns":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"express":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"fastify":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"fs":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"http":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"http2":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"https":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"ioredis":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"iovalkey":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"kafkajs":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"koa":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"memcached":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"mongodb":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"mysql":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"mysql2":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"net":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"next":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"openai":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"pg":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"pino":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"q":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"redis":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"restify":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"router":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"undici":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"when":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"winston":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"zlib":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}}}};const schema50 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"kafka.js","type":"object","properties":{"metrics":{"type":"object","properties":{"cluster":{"type":"object","properties":{"metrics":{"type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Enables capture of the `MessageBroker/Kafka/Cluster/{cluster_id}/{Produce|Consume}/{topic_name}` metrics. Disabled by default."}},"additionalProperties":true}},"additionalProperties":true}},"additionalProperties":true}},"additionalProperties":true,"description":"Stanza for customizing behavior for Kafka instrumentation"};const schema51 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"logging.js","type":"object","properties":{"level":{"type":"string","default":"info","description":"Verbosity of the module's logging. This module uses bunyan (https://github.com/trentm/node-bunyan) for its logging, and as such the valid logging levels are 'fatal', 'error', 'warn', 'info', 'debug' and 'trace'. Logging at levels 'info' and higher is very terse. For support requests, attaching logs captured at 'trace' level are extremely helpful in chasing down bugs.","x-newrelic-env-var":"NEW_RELIC_LOG_LEVEL"},"filepath":{"type":"string","description":"Where to put the log file -- by default just uses process.cwd + 'newrelic_agent.log'. A special case is a filepath of 'stdout', in which case all logging will go to stdout, or 'stderr', in which case all logging will go to stderr.","x-newrelic-env-var":"NEW_RELIC_LOG"},"enabled":{"type":"boolean","default":true,"description":"Whether to write to a log file at all","x-newrelic-env-var":"NEW_RELIC_LOG_ENABLED"},"diagnostics":{"type":"boolean","default":false,"x-newrelic-internal":true,"description":"Whether to enable internal agent diagnostics logging."}},"additionalProperties":true};const schema52 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"message-tracer.js","type":"object","properties":{"segment_parameters":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls behavior of message broker tracing. Enables reporting parameters on message broker segments."};const schema53 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"opentelemetry.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Global switch for the whole OpenTelemetry feature. If it is set to `false`, any other sub-feature, e.g. `traces`, will not be enabled regardless of that specific sub-feature setting."},"traces":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true,"description":"`traces` are instrumentations, e.g. `@fastify/otel`. Enabling `traces` enables bridging OpenTelemetry instrumentations into the New Relic agent."},"logs":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true,"description":"`logs` governs automatic configuration of the OpenTelemetry logs API. When true, the agent will automatically configure the logs API to send logs emitted through the OTEL specific API to New Relic. This feature is dependent on application logs forwarding. Thus, application logs forwarding must be enabled as well."},"metrics":{"type":"object","properties":{"enabled":{"type":"boolean","default":true},"export_interval":{"type":"integer","default":60000,"description":"`export_interval` defines the number of milliseconds between each attempt to ship metrics to New Relic. This value must be equal to or greater than the value of `export_timeout`."},"export_timeout":{"type":"integer","default":10000,"description":"`export_timeout` defines the number of milliseconds an export operation is allowed in order to successfully complete. If the timeout is exceeded, it will be reported via the OpenTelemetry diagnostics API."}},"additionalProperties":true,"description":"`metrics` governs automatic configuration of the OpenTelemetry metrics API. When `true`, the agent will automatically configure the metrics API to send metrics to New Relic and attach them to the application entity that is instrumented by the New Relic agent."}},"additionalProperties":true,"description":"Governs the various OpenTelemetry based features provided by the agent. NOTICE: this configuration is subject to change while the OTEL feature set is in development."};const schema54 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"plugins.js","type":"object","properties":{"native_metrics":{"type":"object","properties":{"enabled":{"x-newrelic-env-var":"NEW_RELIC_NATIVE_METRICS_ENABLED","type":"boolean","default":true}},"additionalProperties":true,"description":"Controls usage of the native metrics module which samples VM and event loop data."}},"additionalProperties":true};const schema55 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"process-host.js","type":"object","properties":{"display_name":{"type":"string","default":"","description":"Configurable display name for hosts"},"ipv_preference":{"x-newrelic-env-var":"NEW_RELIC_IPV_PREFERENCE","x-newrelic-coerce":"allowList","type":"string","enum":["4","6"],"default":"4","description":"ip address preference when creating hostnames"}},"additionalProperties":true,"description":"This is used to configure properties about the user's host name."};const schema56 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"profiling.js","type":"object","properties":{"enabled":{"type":"boolean","default":false},"include":{"type":"array","items":{"type":"string"},"default":["cpu","heap"],"description":"List of profile type names to enable. Only cpu and heap profiles are currently supported"},"delay":{"type":"integer","default":0,"description":"Delay in milliseconds before starting profiler."},"duration":{"type":"integer","default":0,"description":"If >0, stop profiler after this many milliseconds of operation."},"source_mapping":{"type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"When set to `true`, resolves profiler frames to their original source files/lines using source maps, instead of the compiled output."}},"additionalProperties":true},"sample_interval":{"type":"integer","default":100,"description":"The interval in milliseconds at which to harvest and ingest profile data."}},"additionalProperties":true,"description":"Controls the behavior of the profiler."};const schema57 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"rules.js","type":"object","properties":{"name":{"x-newrelic-env-var":"NEW_RELIC_NAMING_RULES","x-newrelic-coerce":"objectList","type":"array","items":{},"default":[],"description":"A list of rules of the format {pattern: 'pattern', name: 'name'} for matching incoming request URLs and naming the associated New Relic transactions. Both pattern and name are required. Additional attributes are ignored. Patterns may have capture groups (following JavaScript conventions), and names will use $1-style replacement strings. See the documentation for addNamingRule for important caveats."},"ignore":{"x-newrelic-env-var":"NEW_RELIC_IGNORING_RULES","type":"array","items":{"type":["string","object"]},"default":["^/socket.io/.*/xhr-polling/"],"description":"A list of patterns for matching incoming request URLs to be ignored by the agent. Patterns may be strings or regular expressions. By default, socket.io long-polling is ignored. env NEW_RELIC_IGNORING_RULES"}},"additionalProperties":true,"description":"Rules for naming or ignoring transactions."};const schema58 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"security.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Toggles the generation of security events by the security agent."},"agent":{"type":"object","properties":{"enabled":{"type":"boolean","default":false}},"additionalProperties":true,"description":"Flag to tell the Node.js agent to load the security agent. This property is read only once at application start."},"mode":{"x-newrelic-coerce":"allowList","type":"string","enum":["IAST","RASP"],"default":"IAST","description":"Security agent provides two modes: IAST and RASP. Default is IAST."},"validator_service_url":{"type":"string","default":"wss://csec.nr-data.net","description":"Security agent validator URL. Must be prefixed with wss://."},"detection":{"type":"object","properties":{"rci":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true},"rxss":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true},"deserialization":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true}},"additionalProperties":true,"description":"Provide ability to toggle sending security events for the following rules."},"iast_test_identifier":{"type":"string","default":"","description":"Unique test identifier when running IAST with CI/CD"},"scan_controllers":{"type":"object","properties":{"iast_scan_request_rate_limit":{"type":"integer","default":3600,"description":"The maximum number of analysis probes or requests that can be sent to the application in one minute."},"scan_instance_count":{"type":"integer","default":0,"description":"The number of application instances for a specific entity where IAST analysis is performed. Values are 0 or 1, 0 signifies run on all application instances"}},"additionalProperties":true,"description":"IAST scan controllers to get more control over IAST analysis"},"scan_schedule":{"type":"object","properties":{"delay":{"type":"integer","default":0,"description":"The delay field specifies the time in minutes before an IAST scan begins after the application starts"},"duration":{"type":"integer","default":0,"description":"The duration field specifies the amount of time in minutes that the IAST scan will run"},"schedule":{"type":"string","default":"","description":"The schedule field specifies a unix cron expression that defines when the IAST scan should run. By default, schedule is disabled"},"always_sample_traces":{"type":"boolean","default":false,"description":"Allows IAST to actively collect trace data in the background and the security agent will use this collected data to perform an IAST scan at the scheduled time"}},"additionalProperties":true,"description":"Schedule start and stop of IAST scan"},"exclude_from_iast_scan":{"type":"object","properties":{"api":{"type":"array","items":{"type":"string"},"default":[],"description":"Ignore specific APIs from IAST analysis. The regex pattern should provide a full match for the URL without the endpoint."},"http_request_parameters":{"type":"object","properties":{"header":{"type":"array","items":{"type":"string"},"default":[]},"query":{"type":"array","items":{"type":"string"},"default":[]},"body":{"type":"array","items":{"type":"string"},"default":[]}},"additionalProperties":true,"description":"Ignore specific HTTP request parameters from IAST analysis."},"iast_detection_category":{"type":"object","properties":{"insecure_settings":{"type":"boolean","default":false},"invalid_file_access":{"type":"boolean","default":false},"sql_injection":{"type":"boolean","default":false},"nosql_injection":{"type":"boolean","default":false},"ldap_injection":{"type":"boolean","default":false},"javascript_injection":{"type":"boolean","default":false},"command_injection":{"type":"boolean","default":false},"xpath_injection":{"type":"boolean","default":false},"ssrf":{"type":"boolean","default":false},"rxss":{"type":"boolean","default":false}},"additionalProperties":true,"description":"Allows users to specify categories of vulnerabilities for which IAST analysis will be applied or ignored."}},"additionalProperties":true,"description":"The exclude from IAST scan setting allows to exclude specific APIs, vulnerability categories, and parameters from IAST analysis."}},"additionalProperties":true,"description":"Security agent configurations"};const schema59 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"serverless-mode.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Specifies whether the agent will be used to monitor serverless functions (e.g. AWS Lambda). Defaults to true when the AWS_LAMBDA_FUNCTION_NAME environment variable is present, false otherwise."}},"additionalProperties":true,"description":"Specifies whether the agent will be used to monitor serverless functions. For example: AWS Lambda"};const schema60 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"slow-sql.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Enables and disables `slow_sql` recording."},"max_samples":{"x-newrelic-env-var":"NEW_RELIC_MAX_SQL_SAMPLES","type":"integer","default":10,"description":"Sets the maximum number of slow query samples that will be collected in a single harvest cycle. env NEW_RELIC_MAX_SQL_SAMPLES"}},"additionalProperties":true,"description":"These options control behavior for slow queries, but do not affect sql nodes in transaction traces."};const schema61 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"span-events.js","type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"Enables/disables span event generation"},"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, the agent captures attributes from span events."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude in span events. Allows * as wildcard at end."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in span events. Allows * as wildcard at end."}},"additionalProperties":true},"max_samples_stored":{"type":"integer","default":2000,"description":"The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected."}},"additionalProperties":true,"description":"Controls the behavior of span events produced by the agent."};const schema62 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"strip-exception-messages.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"When `true`, the agent will redact the messages of captured errors."}},"additionalProperties":true,"description":"Error message redaction Options regarding how the agent handles the redaction of error messages."};const schema63 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"transaction-events.js","type":"object","properties":{"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, the agent captures attributes from transaction events."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude in transaction events. Allows * as wildcard at end. env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_EXCLUDE"},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in transaction events. Allows * as wildcard at end. env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_INCLUDE"}},"additionalProperties":true},"enabled":{"type":"boolean","default":true,"description":"If this is disabled, the agent does not collect, nor try to send, analytic data."},"max_samples_stored":{"type":"integer","default":10000,"description":"The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected."}},"additionalProperties":true,"description":"Transaction Events Transaction events are sent to New Relic Insights. This event data includes transaction timing, transaction name, and any custom parameters. Read more here: http://newrelic.com/insights"};const schema64 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"transaction-segments.js","type":"object","properties":{"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, the agent captures attributes from transaction segments."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude in transaction segments. Allows * as wildcard at end."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in transaction segments. Allows * as wildcard at end."}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls the behavior of transaction segments produced by the agent."};const schema65 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"transaction-tracer.js","type":"object","properties":{"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, the agent captures attributes from transaction traces."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude from transaction traces. Allows * as wildcard at end."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in transaction traces. Allows * as wildcard at end."}},"additionalProperties":true},"enabled":{"x-newrelic-env-var":"NEW_RELIC_TRACER_ENABLED","type":"boolean","default":true,"description":"Whether to collect & submit slow transaction traces to New Relic. The instrumentation is loaded regardless of this setting, as it's necessary to gather metrics. Disable the agent to prevent the instrumentation from loading."},"transaction_threshold":{"x-newrelic-env-var":"NEW_RELIC_TRACER_THRESHOLD","x-newrelic-coerce":"numericOrString","type":["number","string"],"default":"apdex_f","description":"Sets the time, in seconds, for a transaction to be considered slow. When a transaction exceeds this threshold, a transaction trace will be recorded. When set to 'apdex_f', the threshold will be set to 4 * apdex_t, which with a default apdex_t value of 500 milliseconds will be 2 seconds. If a number is provided, it is set in seconds."},"top_n":{"x-newrelic-env-var":"NEW_RELIC_TRACER_TOP_N","type":"integer","default":20,"description":"Increase this parameter to increase the diversity of the slow transaction traces recorded by your application over time. Confused? Read on. Transactions are named based on the request (see the README for the details of how requests are mapped to transactions), and top_n refers to the \"top n slowest transactions\" grouped by these names. The module will only replace a recorded trace with a new trace if the new trace is slower than the previous slowest trace of that name. The default value for this setting is 20, as the transaction trace view page also defaults to showing the 20 slowest transactions. If you want to record the absolute slowest transaction over the last minute, set top_n to 0 or 1. This used to be the default, and has a problem in that it will allow one very slow route to dominate your slow transaction traces. The module will always record at least 5 different slow transactions in the reporting periods after it starts up, and will reset its internal slow trace aggregator if no slow transactions have been recorded for the last 5 harvest cycles, restarting the aggregation process. env NEW_RELIC_TRACER_TOP_N"},"record_sql":{"x-newrelic-env-var":"NEW_RELIC_RECORD_SQL","x-newrelic-coerce":"allowList","type":"string","enum":["off","obfuscated","raw"],"default":"obfuscated","description":"This option affects both slow-queries and record_sql for transaction traces. It can have one of 3 values: 'off', 'obfuscated' or 'raw' When it is 'off' no slow queries will be captured, and backtraces and sql will not be included in transaction traces. If it is 'raw' or 'obfuscated' and other criteria (slow_sql.enabled etc) are met for a query. The raw or obfuscated sql will be included in the transaction trace and a slow query sample will be collected."},"explain_threshold":{"x-newrelic-env-var":"NEW_RELIC_EXPLAIN_THRESHOLD","type":"integer","default":500,"description":"This option affects both slow-queries and record_sql for transaction traces. This is the minimum duration a query must take (in ms) for it to be considered for for slow query and inclusion in transaction traces."}},"additionalProperties":true};const schema66 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"url-obfuscation.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Toggles whether to obfuscate URL parameters"},"regex":{"type":"object","properties":{"pattern":{"x-newrelic-coerce":"regex","type":"string","description":"Must be a valid regular expression.","default":null},"flags":{"type":"string","default":"","description":"A string containing RegEx flags to use when matching URL parameters"},"replacement":{"type":"string","default":"","description":"A string containing a replacement value for URL parameters can contain references to capture groups in the pattern"}},"additionalProperties":true}},"additionalProperties":true,"description":"Obfuscates URL parameters for outgoing and incoming requests for distributed tracing attributes - both transaction and span attributes for transaction trace transaction details"};const schema67 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"utilization.js","type":"object","properties":{"detect_aws":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to reach out to AWS to get info about the vm the process is running on."},"detect_pcf":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to detect if the the process is running on Pivotal Cloud Foundry."},"detect_azure":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to reach out to Azure to get info about the vm the process is running on."},"detect_azurefunction":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to read environment variables and invocation context to get info about the Azure Function called."},"detect_docker":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to read files to get info about the container the process is running in. env NEW_RELIC_UTILIZATION_DETECT_DOCKER"},"detect_gcp":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to reach out to GCP to get info about the vm the process is running on."},"detect_kubernetes":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to reach out to Kubernetes to get info about the container the process is running on."},"logical_processors":{"type":"number","default":null},"billing_hostname":{"type":["string","null"],"default":null},"total_ram_mib":{"type":"integer","default":null},"gcp_use_instance_as_host":{"type":"boolean","default":true,"description":"Deprecated and will be removed in v15 of the agent. Please use `utilization.gcp_cloud_run.use_instance_as_host` instead. When enabled, it will use the GCP metadata id to set the hostname of the running application (Services, Worker Pools, and Jobs)."},"gcp_cloud_run":{"type":"object","properties":{"include_revision_in_host":{"type":"boolean","default":false,"description":"If `true`, the agent prepends the Cloud Run revision name to the GCP instance id to form the hostname (`{revision}-{instance id}`) on Google Cloud Run. The revision name comes from `K_REVISION` on a Cloud Run Service, `CLOUD_RUN_REVISION` on a Cloud Run Worker Pool, and `CLOUD_RUN_EXECUTION` on a Cloud Run Job. Has no effect unless `utilization.gcp_use_instance_as_host` is also `true`."},"use_instance_as_host":{"type":"boolean","default":true,"description":"When enabled, it will use the GCP metadata id to set the hostname of the running application (Services, Worker Pools, and Jobs)."}},"additionalProperties":true}},"additionalProperties":true,"description":"Options regarding collecting system information. Used for system utilization based pricing scheme."};const schema68 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"worker-threads.js","type":"object","properties":{"enabled":{"type":"boolean","default":false}},"additionalProperties":true,"description":"When enabled, it will allow loading of the agent in worker threads. In 11.0.0 we added code to prevent loading in worker threads to cut down on unnecessary overhead of the agent. We have found in testing that traces and spans were useless unless work was completely self contained in the worker thread."};const func1 = Object.prototype.hasOwnProperty;function validate20(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){/*# sourceURL="root.js" */;let vErrors = null;let errors = 0;const evaluated0 = validate20.evaluated;if(evaluated0.dynamicProps){evaluated0.props = undefined;}if(evaluated0.dynamicItems){evaluated0.items = undefined;}if(data && typeof data == "object" && !Array.isArray(data)){if(data.account_id !== undefined){let data0 = data.account_id;if(((typeof data0 !== "string") && (!(typeof data0 == "number"))) && (data0 !== null)){let dataType0 = typeof data0;let coerced0 = undefined;if(!(coerced0 !== undefined)){if(dataType0 == "number" || dataType0 == "boolean"){coerced0 = "" + data0;}else if(data0 === null){coerced0 = "";}else if(dataType0 == "boolean" || data0 === null
                  || (dataType0 == "string" && data0 && data0 == +data0)){coerced0 = +data0;}else if(data0 === "" || data0 === 0 || data0 === false){coerced0 = null;}else {const err0 = {instancePath:instancePath+"/account_id",schemaPath:"#/properties/account_id/type",keyword:"type",params:{type: schema31.properties.account_id.type},message:"must be string,number,null"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}}if(coerced0 !== undefined){data0 = coerced0;if(data !== undefined){data["account_id"] = coerced0;}}}}if(data.agent_enabled !== undefined){let data1 = data.agent_enabled;if(typeof data1 !== "boolean"){let coerced1 = undefined;if(!(coerced1 !== undefined)){if(data1 === "false" || data1 === 0 || data1 === null){coerced1 = false;}else if(data1 === "true" || data1 === 1){coerced1 = true;}else {const err1 = {instancePath:instancePath+"/agent_enabled",schemaPath:"#/properties/agent_enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}}if(coerced1 !== undefined){data1 = coerced1;if(data !== undefined){data["agent_enabled"] = coerced1;}}}}if(data.allow_all_headers !== undefined){let data2 = data.allow_all_headers;if(typeof data2 !== "boolean"){let coerced2 = undefined;if(!(coerced2 !== undefined)){if(data2 === "false" || data2 === 0 || data2 === null){coerced2 = false;}else if(data2 === "true" || data2 === 1){coerced2 = true;}else {const err2 = {instancePath:instancePath+"/allow_all_headers",schemaPath:"#/properties/allow_all_headers/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;}}if(coerced2 !== undefined){data2 = coerced2;if(data !== undefined){data["allow_all_headers"] = coerced2;}}}}if(data.apdex_t !== undefined){let data3 = data.apdex_t;if(!(typeof data3 == "number")){let dataType3 = typeof data3;let coerced3 = undefined;if(!(coerced3 !== undefined)){if(dataType3 == "boolean" || data3 === null
                  || (dataType3 == "string" && data3 && data3 == +data3)){coerced3 = +data3;}else {const err3 = {instancePath:instancePath+"/apdex_t",schemaPath:"#/properties/apdex_t/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err3];}else {vErrors.push(err3);}errors++;}}if(coerced3 !== undefined){data3 = coerced3;if(data !== undefined){data["apdex_t"] = coerced3;}}}}if(data.apm_lambda_mode !== undefined){let data4 = data.apm_lambda_mode;if(typeof data4 !== "boolean"){let coerced4 = undefined;if(!(coerced4 !== undefined)){if(data4 === "false" || data4 === 0 || data4 === null){coerced4 = false;}else if(data4 === "true" || data4 === 1){coerced4 = true;}else {const err4 = {instancePath:instancePath+"/apm_lambda_mode",schemaPath:"#/properties/apm_lambda_mode/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err4];}else {vErrors.push(err4);}errors++;}}if(coerced4 !== undefined){data4 = coerced4;if(data !== undefined){data["apm_lambda_mode"] = coerced4;}}}}if(data.app_name !== undefined){let data5 = data.app_name;const _errs13 = errors;let valid1 = false;let passing0 = null;const _errs14 = errors;if(Array.isArray(data5)){const len0 = data5.length;for(let i0=0; i0<len0; i0++){let data6 = data5[i0];if(typeof data6 !== "string"){let dataType5 = typeof data6;let coerced5 = undefined;if(!(coerced5 !== undefined)){if(dataType5 == "number" || dataType5 == "boolean"){coerced5 = "" + data6;}else if(data6 === null){coerced5 = "";}else {const err5 = {instancePath:instancePath+"/app_name/" + i0,schemaPath:"#/properties/app_name/oneOf/0/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err5];}else {vErrors.push(err5);}errors++;}}if(coerced5 !== undefined){data6 = coerced5;if(data5 !== undefined){data5[i0] = coerced5;}}}}}else {const err6 = {instancePath:instancePath+"/app_name",schemaPath:"#/properties/app_name/oneOf/0/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err6];}else {vErrors.push(err6);}errors++;}var _valid0 = _errs14 === errors;if(_valid0){valid1 = true;passing0 = 0;}const _errs18 = errors;if(typeof data5 !== "string"){let dataType6 = typeof data5;let coerced6 = undefined;if(!(coerced6 !== undefined)){if(dataType6 == "number" || dataType6 == "boolean"){coerced6 = "" + data5;}else if(data5 === null){coerced6 = "";}else {const err7 = {instancePath:instancePath+"/app_name",schemaPath:"#/properties/app_name/oneOf/1/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err7];}else {vErrors.push(err7);}errors++;}}if(coerced6 !== undefined){data5 = coerced6;if(data !== undefined){data["app_name"] = coerced6;}}}var _valid0 = _errs18 === errors;if(_valid0 && valid1){valid1 = false;passing0 = [passing0, 1];}else {if(_valid0){valid1 = true;passing0 = 1;}}if(!valid1){const err8 = {instancePath:instancePath+"/app_name",schemaPath:"#/properties/app_name/oneOf",keyword:"oneOf",params:{passingSchemas: passing0},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err8];}else {vErrors.push(err8);}errors++;}else {errors = _errs13;if(vErrors !== null){if(_errs13){vErrors.length = _errs13;}else {vErrors = null;}}}}if(data.certificates !== undefined){let data7 = data.certificates;if(Array.isArray(data7)){const len1 = data7.length;for(let i1=0; i1<len1; i1++){let data8 = data7[i1];if(typeof data8 !== "string"){let dataType7 = typeof data8;let coerced7 = undefined;if(!(coerced7 !== undefined)){if(dataType7 == "number" || dataType7 == "boolean"){coerced7 = "" + data8;}else if(data8 === null){coerced7 = "";}else {const err9 = {instancePath:instancePath+"/certificates/" + i1,schemaPath:"#/properties/certificates/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err9];}else {vErrors.push(err9);}errors++;}}if(coerced7 !== undefined){data8 = coerced7;if(data7 !== undefined){data7[i1] = coerced7;}}}}}else {const err10 = {instancePath:instancePath+"/certificates",schemaPath:"#/properties/certificates/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err10];}else {vErrors.push(err10);}errors++;}}if(data.compressed_content_encoding !== undefined){let data9 = data.compressed_content_encoding;if(typeof data9 !== "string"){let dataType8 = typeof data9;let coerced8 = undefined;if(!(coerced8 !== undefined)){if(dataType8 == "number" || dataType8 == "boolean"){coerced8 = "" + data9;}else if(data9 === null){coerced8 = "";}else {const err11 = {instancePath:instancePath+"/compressed_content_encoding",schemaPath:"#/properties/compressed_content_encoding/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err11];}else {vErrors.push(err11);}errors++;}}if(coerced8 !== undefined){data9 = coerced8;if(data !== undefined){data["compressed_content_encoding"] = coerced8;}}}}if(data.enforce_backstop !== undefined){let data10 = data.enforce_backstop;if(typeof data10 !== "boolean"){let coerced9 = undefined;if(!(coerced9 !== undefined)){if(data10 === "false" || data10 === 0 || data10 === null){coerced9 = false;}else if(data10 === "true" || data10 === 1){coerced9 = true;}else {const err12 = {instancePath:instancePath+"/enforce_backstop",schemaPath:"#/properties/enforce_backstop/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err12];}else {vErrors.push(err12);}errors++;}}if(coerced9 !== undefined){data10 = coerced9;if(data !== undefined){data["enforce_backstop"] = coerced9;}}}}if(data.high_security !== undefined){let data11 = data.high_security;if(typeof data11 !== "boolean"){let coerced10 = undefined;if(!(coerced10 !== undefined)){if(data11 === "false" || data11 === 0 || data11 === null){coerced10 = false;}else if(data11 === "true" || data11 === 1){coerced10 = true;}else {const err13 = {instancePath:instancePath+"/high_security",schemaPath:"#/properties/high_security/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err13];}else {vErrors.push(err13);}errors++;}}if(coerced10 !== undefined){data11 = coerced10;if(data !== undefined){data["high_security"] = coerced10;}}}}if(data.host !== undefined){let data12 = data.host;if(typeof data12 !== "string"){let dataType11 = typeof data12;let coerced11 = undefined;if(!(coerced11 !== undefined)){if(dataType11 == "number" || dataType11 == "boolean"){coerced11 = "" + data12;}else if(data12 === null){coerced11 = "";}else {const err14 = {instancePath:instancePath+"/host",schemaPath:"#/properties/host/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err14];}else {vErrors.push(err14);}errors++;}}if(coerced11 !== undefined){data12 = coerced11;if(data !== undefined){data["host"] = coerced11;}}}}if(data.ignore_server_configuration !== undefined){let data13 = data.ignore_server_configuration;if(typeof data13 !== "boolean"){let coerced12 = undefined;if(!(coerced12 !== undefined)){if(data13 === "false" || data13 === 0 || data13 === null){coerced12 = false;}else if(data13 === "true" || data13 === 1){coerced12 = true;}else {const err15 = {instancePath:instancePath+"/ignore_server_configuration",schemaPath:"#/properties/ignore_server_configuration/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err15];}else {vErrors.push(err15);}errors++;}}if(coerced12 !== undefined){data13 = coerced12;if(data !== undefined){data["ignore_server_configuration"] = coerced12;}}}}if(data.labels !== undefined){let data14 = data.labels;const _errs35 = errors;let valid6 = false;let passing1 = null;const _errs36 = errors;if(!(data14 && typeof data14 == "object" && !Array.isArray(data14))){const err16 = {instancePath:instancePath+"/labels",schemaPath:"#/properties/labels/oneOf/0/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err16];}else {vErrors.push(err16);}errors++;}var _valid1 = _errs36 === errors;if(_valid1){valid6 = true;passing1 = 0;}const _errs38 = errors;if(typeof data14 !== "string"){let dataType13 = typeof data14;let coerced13 = undefined;if(!(coerced13 !== undefined)){if(dataType13 == "number" || dataType13 == "boolean"){coerced13 = "" + data14;}else if(data14 === null){coerced13 = "";}else {const err17 = {instancePath:instancePath+"/labels",schemaPath:"#/properties/labels/oneOf/1/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err17];}else {vErrors.push(err17);}errors++;}}if(coerced13 !== undefined){data14 = coerced13;if(data !== undefined){data["labels"] = coerced13;}}}var _valid1 = _errs38 === errors;if(_valid1 && valid6){valid6 = false;passing1 = [passing1, 1];}else {if(_valid1){valid6 = true;passing1 = 1;}}if(!valid6){const err18 = {instancePath:instancePath+"/labels",schemaPath:"#/properties/labels/oneOf",keyword:"oneOf",params:{passingSchemas: passing1},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err18];}else {vErrors.push(err18);}errors++;}else {errors = _errs35;if(vErrors !== null){if(_errs35){vErrors.length = _errs35;}else {vErrors = null;}}}}if(data.license_key !== undefined){let data15 = data.license_key;if(typeof data15 !== "string"){let dataType14 = typeof data15;let coerced14 = undefined;if(!(coerced14 !== undefined)){if(dataType14 == "number" || dataType14 == "boolean"){coerced14 = "" + data15;}else if(data15 === null){coerced14 = "";}else {const err19 = {instancePath:instancePath+"/license_key",schemaPath:"#/properties/license_key/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err19];}else {vErrors.push(err19);}errors++;}}if(coerced14 !== undefined){data15 = coerced14;if(data !== undefined){data["license_key"] = coerced14;}}}}if(data.newrelic_home !== undefined){let data16 = data.newrelic_home;if((typeof data16 !== "string") && (data16 !== null)){let dataType15 = typeof data16;let coerced15 = undefined;if(!(coerced15 !== undefined)){if(dataType15 == "number" || dataType15 == "boolean"){coerced15 = "" + data16;}else if(data16 === null){coerced15 = "";}else if(data16 === "" || data16 === 0 || data16 === false){coerced15 = null;}else {const err20 = {instancePath:instancePath+"/newrelic_home",schemaPath:"#/properties/newrelic_home/type",keyword:"type",params:{type: schema31.properties.newrelic_home.type},message:"must be string,null"};if(vErrors === null){vErrors = [err20];}else {vErrors.push(err20);}errors++;}}if(coerced15 !== undefined){data16 = coerced15;if(data !== undefined){data["newrelic_home"] = coerced15;}}}}if(data.port !== undefined){let data17 = data.port;if(!((typeof data17 == "number") && (!(data17 % 1) && !isNaN(data17)))){let dataType16 = typeof data17;let coerced16 = undefined;if(!(coerced16 !== undefined)){if(dataType16 === "boolean" || data17 === null
                  || (dataType16 === "string" && data17 && data17 == +data17 && !(data17 % 1))){coerced16 = +data17;}else {const err21 = {instancePath:instancePath+"/port",schemaPath:"#/properties/port/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err21];}else {vErrors.push(err21);}errors++;}}if(coerced16 !== undefined){data17 = coerced16;if(data !== undefined){data["port"] = coerced16;}}}}if(data.primary_application_id !== undefined){let data18 = data.primary_application_id;if(((typeof data18 !== "string") && (!(typeof data18 == "number"))) && (data18 !== null)){let dataType17 = typeof data18;let coerced17 = undefined;if(!(coerced17 !== undefined)){if(dataType17 == "number" || dataType17 == "boolean"){coerced17 = "" + data18;}else if(data18 === null){coerced17 = "";}else if(dataType17 == "boolean" || data18 === null
                  || (dataType17 == "string" && data18 && data18 == +data18)){coerced17 = +data18;}else if(data18 === "" || data18 === 0 || data18 === false){coerced17 = null;}else {const err22 = {instancePath:instancePath+"/primary_application_id",schemaPath:"#/properties/primary_application_id/type",keyword:"type",params:{type: schema31.properties.primary_application_id.type},message:"must be string,number,null"};if(vErrors === null){vErrors = [err22];}else {vErrors.push(err22);}errors++;}}if(coerced17 !== undefined){data18 = coerced17;if(data !== undefined){data["primary_application_id"] = coerced17;}}}}if(data.proxy !== undefined){let data19 = data.proxy;if(typeof data19 !== "string"){let dataType18 = typeof data19;let coerced18 = undefined;if(!(coerced18 !== undefined)){if(dataType18 == "number" || dataType18 == "boolean"){coerced18 = "" + data19;}else if(data19 === null){coerced18 = "";}else {const err23 = {instancePath:instancePath+"/proxy",schemaPath:"#/properties/proxy/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err23];}else {vErrors.push(err23);}errors++;}}if(coerced18 !== undefined){data19 = coerced18;if(data !== undefined){data["proxy"] = coerced18;}}}}if(data.proxy_host !== undefined){let data20 = data.proxy_host;if(typeof data20 !== "string"){let dataType19 = typeof data20;let coerced19 = undefined;if(!(coerced19 !== undefined)){if(dataType19 == "number" || dataType19 == "boolean"){coerced19 = "" + data20;}else if(data20 === null){coerced19 = "";}else {const err24 = {instancePath:instancePath+"/proxy_host",schemaPath:"#/properties/proxy_host/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err24];}else {vErrors.push(err24);}errors++;}}if(coerced19 !== undefined){data20 = coerced19;if(data !== undefined){data["proxy_host"] = coerced19;}}}}if(data.proxy_pass !== undefined){let data21 = data.proxy_pass;if(typeof data21 !== "string"){let dataType20 = typeof data21;let coerced20 = undefined;if(!(coerced20 !== undefined)){if(dataType20 == "number" || dataType20 == "boolean"){coerced20 = "" + data21;}else if(data21 === null){coerced20 = "";}else {const err25 = {instancePath:instancePath+"/proxy_pass",schemaPath:"#/properties/proxy_pass/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err25];}else {vErrors.push(err25);}errors++;}}if(coerced20 !== undefined){data21 = coerced20;if(data !== undefined){data["proxy_pass"] = coerced20;}}}}if(data.proxy_port !== undefined){let data22 = data.proxy_port;if(typeof data22 !== "string"){let dataType21 = typeof data22;let coerced21 = undefined;if(!(coerced21 !== undefined)){if(dataType21 == "number" || dataType21 == "boolean"){coerced21 = "" + data22;}else if(data22 === null){coerced21 = "";}else {const err26 = {instancePath:instancePath+"/proxy_port",schemaPath:"#/properties/proxy_port/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err26];}else {vErrors.push(err26);}errors++;}}if(coerced21 !== undefined){data22 = coerced21;if(data !== undefined){data["proxy_port"] = coerced21;}}}}if(data.proxy_user !== undefined){let data23 = data.proxy_user;if(typeof data23 !== "string"){let dataType22 = typeof data23;let coerced22 = undefined;if(!(coerced22 !== undefined)){if(dataType22 == "number" || dataType22 == "boolean"){coerced22 = "" + data23;}else if(data23 === null){coerced22 = "";}else {const err27 = {instancePath:instancePath+"/proxy_user",schemaPath:"#/properties/proxy_user/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err27];}else {vErrors.push(err27);}errors++;}}if(coerced22 !== undefined){data23 = coerced22;if(data !== undefined){data["proxy_user"] = coerced22;}}}}if(data.ssl !== undefined){let data24 = data.ssl;if(typeof data24 !== "boolean"){let coerced23 = undefined;if(!(coerced23 !== undefined)){if(data24 === "false" || data24 === 0 || data24 === null){coerced23 = false;}else if(data24 === "true" || data24 === 1){coerced23 = true;}else {const err28 = {instancePath:instancePath+"/ssl",schemaPath:"#/properties/ssl/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err28];}else {vErrors.push(err28);}errors++;}}if(coerced23 !== undefined){data24 = coerced23;if(data !== undefined){data["ssl"] = coerced23;}}}if(true !== data24){const err29 = {instancePath:instancePath+"/ssl",schemaPath:"#/properties/ssl/const",keyword:"const",params:{allowedValue: true},message:"must be equal to constant"};if(vErrors === null){vErrors = [err29];}else {vErrors.push(err29);}errors++;}}if(data.trusted_account_key !== undefined){let data25 = data.trusted_account_key;if(((typeof data25 !== "string") && (!(typeof data25 == "number"))) && (data25 !== null)){let dataType24 = typeof data25;let coerced24 = undefined;if(!(coerced24 !== undefined)){if(dataType24 == "number" || dataType24 == "boolean"){coerced24 = "" + data25;}else if(data25 === null){coerced24 = "";}else if(dataType24 == "boolean" || data25 === null
                  || (dataType24 == "string" && data25 && data25 == +data25)){coerced24 = +data25;}else if(data25 === "" || data25 === 0 || data25 === false){coerced24 = null;}else {const err30 = {instancePath:instancePath+"/trusted_account_key",schemaPath:"#/properties/trusted_account_key/type",keyword:"type",params:{type: schema31.properties.trusted_account_key.type},message:"must be string,number,null"};if(vErrors === null){vErrors = [err30];}else {vErrors.push(err30);}errors++;}}if(coerced24 !== undefined){data25 = coerced24;if(data !== undefined){data["trusted_account_key"] = coerced24;}}}}if(data.agent_control !== undefined){let data26 = data.agent_control;if(data26 && typeof data26 == "object" && !Array.isArray(data26)){if(data26.enabled !== undefined){let data27 = data26.enabled;if(typeof data27 !== "boolean"){let coerced25 = undefined;if(!(coerced25 !== undefined)){if(data27 === "false" || data27 === 0 || data27 === null){coerced25 = false;}else if(data27 === "true" || data27 === 1){coerced25 = true;}else {const err31 = {instancePath:instancePath+"/agent_control/enabled",schemaPath:"agent-control.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err31];}else {vErrors.push(err31);}errors++;}}if(coerced25 !== undefined){data27 = coerced25;if(data26 !== undefined){data26["enabled"] = coerced25;}}}}if(data26.health !== undefined){let data28 = data26.health;if(data28 && typeof data28 == "object" && !Array.isArray(data28)){if(data28.delivery_location !== undefined){let data29 = data28.delivery_location;if(typeof data29 !== "string"){let dataType26 = typeof data29;let coerced26 = undefined;if(!(coerced26 !== undefined)){if(dataType26 == "number" || dataType26 == "boolean"){coerced26 = "" + data29;}else if(data29 === null){coerced26 = "";}else {const err32 = {instancePath:instancePath+"/agent_control/health/delivery_location",schemaPath:"agent-control.js/properties/health/properties/delivery_location/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err32];}else {vErrors.push(err32);}errors++;}}if(coerced26 !== undefined){data29 = coerced26;if(data28 !== undefined){data28["delivery_location"] = coerced26;}}}}if(data28.frequency !== undefined){let data30 = data28.frequency;if(!((typeof data30 == "number") && (!(data30 % 1) && !isNaN(data30)))){let dataType27 = typeof data30;let coerced27 = undefined;if(!(coerced27 !== undefined)){if(dataType27 === "boolean" || data30 === null
                  || (dataType27 === "string" && data30 && data30 == +data30 && !(data30 % 1))){coerced27 = +data30;}else {const err33 = {instancePath:instancePath+"/agent_control/health/frequency",schemaPath:"agent-control.js/properties/health/properties/frequency/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err33];}else {vErrors.push(err33);}errors++;}}if(coerced27 !== undefined){data30 = coerced27;if(data28 !== undefined){data28["frequency"] = coerced27;}}}}}else {const err34 = {instancePath:instancePath+"/agent_control/health",schemaPath:"agent-control.js/properties/health/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err34];}else {vErrors.push(err34);}errors++;}}}else {const err35 = {instancePath:instancePath+"/agent_control",schemaPath:"agent-control.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err35];}else {vErrors.push(err35);}errors++;}}if(data.ai_monitoring !== undefined){let data31 = data.ai_monitoring;if(data31 && typeof data31 == "object" && !Array.isArray(data31)){if(data31.enabled !== undefined){let data32 = data31.enabled;if(typeof data32 !== "boolean"){let coerced28 = undefined;if(!(coerced28 !== undefined)){if(data32 === "false" || data32 === 0 || data32 === null){coerced28 = false;}else if(data32 === "true" || data32 === 1){coerced28 = true;}else {const err36 = {instancePath:instancePath+"/ai_monitoring/enabled",schemaPath:"ai-monitoring.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err36];}else {vErrors.push(err36);}errors++;}}if(coerced28 !== undefined){data32 = coerced28;if(data31 !== undefined){data31["enabled"] = coerced28;}}}}if(data31.record_content !== undefined){let data33 = data31.record_content;if(data33 && typeof data33 == "object" && !Array.isArray(data33)){if(data33.enabled !== undefined){let data34 = data33.enabled;if(typeof data34 !== "boolean"){let coerced29 = undefined;if(!(coerced29 !== undefined)){if(data34 === "false" || data34 === 0 || data34 === null){coerced29 = false;}else if(data34 === "true" || data34 === 1){coerced29 = true;}else {const err37 = {instancePath:instancePath+"/ai_monitoring/record_content/enabled",schemaPath:"ai-monitoring.js/properties/record_content/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err37];}else {vErrors.push(err37);}errors++;}}if(coerced29 !== undefined){data34 = coerced29;if(data33 !== undefined){data33["enabled"] = coerced29;}}}}}else {const err38 = {instancePath:instancePath+"/ai_monitoring/record_content",schemaPath:"ai-monitoring.js/properties/record_content/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err38];}else {vErrors.push(err38);}errors++;}}if(data31.streaming !== undefined){let data35 = data31.streaming;if(data35 && typeof data35 == "object" && !Array.isArray(data35)){if(data35.enabled !== undefined){let data36 = data35.enabled;if(typeof data36 !== "boolean"){let coerced30 = undefined;if(!(coerced30 !== undefined)){if(data36 === "false" || data36 === 0 || data36 === null){coerced30 = false;}else if(data36 === "true" || data36 === 1){coerced30 = true;}else {const err39 = {instancePath:instancePath+"/ai_monitoring/streaming/enabled",schemaPath:"ai-monitoring.js/properties/streaming/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err39];}else {vErrors.push(err39);}errors++;}}if(coerced30 !== undefined){data36 = coerced30;if(data35 !== undefined){data35["enabled"] = coerced30;}}}}}else {const err40 = {instancePath:instancePath+"/ai_monitoring/streaming",schemaPath:"ai-monitoring.js/properties/streaming/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err40];}else {vErrors.push(err40);}errors++;}}}else {const err41 = {instancePath:instancePath+"/ai_monitoring",schemaPath:"ai-monitoring.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err41];}else {vErrors.push(err41);}errors++;}}if(data.api !== undefined){let data37 = data.api;if(data37 && typeof data37 == "object" && !Array.isArray(data37)){if(data37.custom_attributes_enabled !== undefined){let data38 = data37.custom_attributes_enabled;if(typeof data38 !== "boolean"){let coerced31 = undefined;if(!(coerced31 !== undefined)){if(data38 === "false" || data38 === 0 || data38 === null){coerced31 = false;}else if(data38 === "true" || data38 === 1){coerced31 = true;}else {const err42 = {instancePath:instancePath+"/api/custom_attributes_enabled",schemaPath:"api.js/properties/custom_attributes_enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err42];}else {vErrors.push(err42);}errors++;}}if(coerced31 !== undefined){data38 = coerced31;if(data37 !== undefined){data37["custom_attributes_enabled"] = coerced31;}}}}if(data37.custom_events_enabled !== undefined){let data39 = data37.custom_events_enabled;if(typeof data39 !== "boolean"){let coerced32 = undefined;if(!(coerced32 !== undefined)){if(data39 === "false" || data39 === 0 || data39 === null){coerced32 = false;}else if(data39 === "true" || data39 === 1){coerced32 = true;}else {const err43 = {instancePath:instancePath+"/api/custom_events_enabled",schemaPath:"api.js/properties/custom_events_enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err43];}else {vErrors.push(err43);}errors++;}}if(coerced32 !== undefined){data39 = coerced32;if(data37 !== undefined){data37["custom_events_enabled"] = coerced32;}}}}if(data37.notice_error_enabled !== undefined){let data40 = data37.notice_error_enabled;if(typeof data40 !== "boolean"){let coerced33 = undefined;if(!(coerced33 !== undefined)){if(data40 === "false" || data40 === 0 || data40 === null){coerced33 = false;}else if(data40 === "true" || data40 === 1){coerced33 = true;}else {const err44 = {instancePath:instancePath+"/api/notice_error_enabled",schemaPath:"api.js/properties/notice_error_enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err44];}else {vErrors.push(err44);}errors++;}}if(coerced33 !== undefined){data40 = coerced33;if(data37 !== undefined){data37["notice_error_enabled"] = coerced33;}}}}}else {const err45 = {instancePath:instancePath+"/api",schemaPath:"api.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err45];}else {vErrors.push(err45);}errors++;}}if(data.apollo_server !== undefined){let data41 = data.apollo_server;if(data41 && typeof data41 == "object" && !Array.isArray(data41)){if(data41.scalars !== undefined){let data42 = data41.scalars;if(typeof data42 !== "boolean"){let coerced34 = undefined;if(!(coerced34 !== undefined)){if(data42 === "false" || data42 === 0 || data42 === null){coerced34 = false;}else if(data42 === "true" || data42 === 1){coerced34 = true;}else {const err46 = {instancePath:instancePath+"/apollo_server/scalars",schemaPath:"apollo-server.js/properties/scalars/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err46];}else {vErrors.push(err46);}errors++;}}if(coerced34 !== undefined){data42 = coerced34;if(data41 !== undefined){data41["scalars"] = coerced34;}}}}if(data41.introspection_queries !== undefined){let data43 = data41.introspection_queries;if(typeof data43 !== "boolean"){let coerced35 = undefined;if(!(coerced35 !== undefined)){if(data43 === "false" || data43 === 0 || data43 === null){coerced35 = false;}else if(data43 === "true" || data43 === 1){coerced35 = true;}else {const err47 = {instancePath:instancePath+"/apollo_server/introspection_queries",schemaPath:"apollo-server.js/properties/introspection_queries/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err47];}else {vErrors.push(err47);}errors++;}}if(coerced35 !== undefined){data43 = coerced35;if(data41 !== undefined){data41["introspection_queries"] = coerced35;}}}}if(data41.service_definition_queries !== undefined){let data44 = data41.service_definition_queries;if(typeof data44 !== "boolean"){let coerced36 = undefined;if(!(coerced36 !== undefined)){if(data44 === "false" || data44 === 0 || data44 === null){coerced36 = false;}else if(data44 === "true" || data44 === 1){coerced36 = true;}else {const err48 = {instancePath:instancePath+"/apollo_server/service_definition_queries",schemaPath:"apollo-server.js/properties/service_definition_queries/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err48];}else {vErrors.push(err48);}errors++;}}if(coerced36 !== undefined){data44 = coerced36;if(data41 !== undefined){data41["service_definition_queries"] = coerced36;}}}}if(data41.health_check_queries !== undefined){let data45 = data41.health_check_queries;if(typeof data45 !== "boolean"){let coerced37 = undefined;if(!(coerced37 !== undefined)){if(data45 === "false" || data45 === 0 || data45 === null){coerced37 = false;}else if(data45 === "true" || data45 === 1){coerced37 = true;}else {const err49 = {instancePath:instancePath+"/apollo_server/health_check_queries",schemaPath:"apollo-server.js/properties/health_check_queries/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err49];}else {vErrors.push(err49);}errors++;}}if(coerced37 !== undefined){data45 = coerced37;if(data41 !== undefined){data41["health_check_queries"] = coerced37;}}}}if(data41.field_metrics !== undefined){let data46 = data41.field_metrics;if(typeof data46 !== "boolean"){let coerced38 = undefined;if(!(coerced38 !== undefined)){if(data46 === "false" || data46 === 0 || data46 === null){coerced38 = false;}else if(data46 === "true" || data46 === 1){coerced38 = true;}else {const err50 = {instancePath:instancePath+"/apollo_server/field_metrics",schemaPath:"apollo-server.js/properties/field_metrics/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err50];}else {vErrors.push(err50);}errors++;}}if(coerced38 !== undefined){data46 = coerced38;if(data41 !== undefined){data41["field_metrics"] = coerced38;}}}}if(data41.collapse_field_metrics !== undefined){let data47 = data41.collapse_field_metrics;if(typeof data47 !== "boolean"){let coerced39 = undefined;if(!(coerced39 !== undefined)){if(data47 === "false" || data47 === 0 || data47 === null){coerced39 = false;}else if(data47 === "true" || data47 === 1){coerced39 = true;}else {const err51 = {instancePath:instancePath+"/apollo_server/collapse_field_metrics",schemaPath:"apollo-server.js/properties/collapse_field_metrics/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err51];}else {vErrors.push(err51);}errors++;}}if(coerced39 !== undefined){data47 = coerced39;if(data41 !== undefined){data41["collapse_field_metrics"] = coerced39;}}}}}else {const err52 = {instancePath:instancePath+"/apollo_server",schemaPath:"apollo-server.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err52];}else {vErrors.push(err52);}errors++;}}if(data.application_logging !== undefined){let data48 = data.application_logging;if(data48 && typeof data48 == "object" && !Array.isArray(data48)){if(data48.enabled !== undefined){let data49 = data48.enabled;if(typeof data49 !== "boolean"){let coerced40 = undefined;if(!(coerced40 !== undefined)){if(data49 === "false" || data49 === 0 || data49 === null){coerced40 = false;}else if(data49 === "true" || data49 === 1){coerced40 = true;}else {const err53 = {instancePath:instancePath+"/application_logging/enabled",schemaPath:"application-logging.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err53];}else {vErrors.push(err53);}errors++;}}if(coerced40 !== undefined){data49 = coerced40;if(data48 !== undefined){data48["enabled"] = coerced40;}}}}if(data48.forwarding !== undefined){let data50 = data48.forwarding;if(data50 && typeof data50 == "object" && !Array.isArray(data50)){if(data50.enabled !== undefined){let data51 = data50.enabled;if(typeof data51 !== "boolean"){let coerced41 = undefined;if(!(coerced41 !== undefined)){if(data51 === "false" || data51 === 0 || data51 === null){coerced41 = false;}else if(data51 === "true" || data51 === 1){coerced41 = true;}else {const err54 = {instancePath:instancePath+"/application_logging/forwarding/enabled",schemaPath:"application-logging.js/properties/forwarding/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err54];}else {vErrors.push(err54);}errors++;}}if(coerced41 !== undefined){data51 = coerced41;if(data50 !== undefined){data50["enabled"] = coerced41;}}}}if(data50.max_samples_stored !== undefined){let data52 = data50.max_samples_stored;if(!((typeof data52 == "number") && (!(data52 % 1) && !isNaN(data52)))){let dataType42 = typeof data52;let coerced42 = undefined;if(!(coerced42 !== undefined)){if(dataType42 === "boolean" || data52 === null
                  || (dataType42 === "string" && data52 && data52 == +data52 && !(data52 % 1))){coerced42 = +data52;}else {const err55 = {instancePath:instancePath+"/application_logging/forwarding/max_samples_stored",schemaPath:"application-logging.js/properties/forwarding/properties/max_samples_stored/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err55];}else {vErrors.push(err55);}errors++;}}if(coerced42 !== undefined){data52 = coerced42;if(data50 !== undefined){data50["max_samples_stored"] = coerced42;}}}}if(data50.labels !== undefined){let data53 = data50.labels;if(data53 && typeof data53 == "object" && !Array.isArray(data53)){if(data53.enabled !== undefined){let data54 = data53.enabled;if(typeof data54 !== "boolean"){let coerced43 = undefined;if(!(coerced43 !== undefined)){if(data54 === "false" || data54 === 0 || data54 === null){coerced43 = false;}else if(data54 === "true" || data54 === 1){coerced43 = true;}else {const err56 = {instancePath:instancePath+"/application_logging/forwarding/labels/enabled",schemaPath:"application-logging.js/properties/forwarding/properties/labels/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err56];}else {vErrors.push(err56);}errors++;}}if(coerced43 !== undefined){data54 = coerced43;if(data53 !== undefined){data53["enabled"] = coerced43;}}}}if(data53.exclude !== undefined){let data55 = data53.exclude;if(Array.isArray(data55)){const len2 = data55.length;for(let i2=0; i2<len2; i2++){let data56 = data55[i2];if(typeof data56 !== "string"){let dataType44 = typeof data56;let coerced44 = undefined;if(!(coerced44 !== undefined)){if(dataType44 == "number" || dataType44 == "boolean"){coerced44 = "" + data56;}else if(data56 === null){coerced44 = "";}else {const err57 = {instancePath:instancePath+"/application_logging/forwarding/labels/exclude/" + i2,schemaPath:"application-logging.js/properties/forwarding/properties/labels/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err57];}else {vErrors.push(err57);}errors++;}}if(coerced44 !== undefined){data56 = coerced44;if(data55 !== undefined){data55[i2] = coerced44;}}}}}else {const err58 = {instancePath:instancePath+"/application_logging/forwarding/labels/exclude",schemaPath:"application-logging.js/properties/forwarding/properties/labels/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err58];}else {vErrors.push(err58);}errors++;}}}else {const err59 = {instancePath:instancePath+"/application_logging/forwarding/labels",schemaPath:"application-logging.js/properties/forwarding/properties/labels/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err59];}else {vErrors.push(err59);}errors++;}}}else {const err60 = {instancePath:instancePath+"/application_logging/forwarding",schemaPath:"application-logging.js/properties/forwarding/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err60];}else {vErrors.push(err60);}errors++;}}if(data48.metrics !== undefined){let data57 = data48.metrics;if(data57 && typeof data57 == "object" && !Array.isArray(data57)){if(data57.enabled !== undefined){let data58 = data57.enabled;if(typeof data58 !== "boolean"){let coerced45 = undefined;if(!(coerced45 !== undefined)){if(data58 === "false" || data58 === 0 || data58 === null){coerced45 = false;}else if(data58 === "true" || data58 === 1){coerced45 = true;}else {const err61 = {instancePath:instancePath+"/application_logging/metrics/enabled",schemaPath:"application-logging.js/properties/metrics/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err61];}else {vErrors.push(err61);}errors++;}}if(coerced45 !== undefined){data58 = coerced45;if(data57 !== undefined){data57["enabled"] = coerced45;}}}}}else {const err62 = {instancePath:instancePath+"/application_logging/metrics",schemaPath:"application-logging.js/properties/metrics/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err62];}else {vErrors.push(err62);}errors++;}}if(data48.local_decorating !== undefined){let data59 = data48.local_decorating;if(data59 && typeof data59 == "object" && !Array.isArray(data59)){if(data59.enabled !== undefined){let data60 = data59.enabled;if(typeof data60 !== "boolean"){let coerced46 = undefined;if(!(coerced46 !== undefined)){if(data60 === "false" || data60 === 0 || data60 === null){coerced46 = false;}else if(data60 === "true" || data60 === 1){coerced46 = true;}else {const err63 = {instancePath:instancePath+"/application_logging/local_decorating/enabled",schemaPath:"application-logging.js/properties/local_decorating/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err63];}else {vErrors.push(err63);}errors++;}}if(coerced46 !== undefined){data60 = coerced46;if(data59 !== undefined){data59["enabled"] = coerced46;}}}}}else {const err64 = {instancePath:instancePath+"/application_logging/local_decorating",schemaPath:"application-logging.js/properties/local_decorating/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err64];}else {vErrors.push(err64);}errors++;}}}else {const err65 = {instancePath:instancePath+"/application_logging",schemaPath:"application-logging.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err65];}else {vErrors.push(err65);}errors++;}}if(data.attributes !== undefined){let data61 = data.attributes;if(data61 && typeof data61 == "object" && !Array.isArray(data61)){if(data61.enabled !== undefined){let data62 = data61.enabled;if(typeof data62 !== "boolean"){let coerced47 = undefined;if(!(coerced47 !== undefined)){if(data62 === "false" || data62 === 0 || data62 === null){coerced47 = false;}else if(data62 === "true" || data62 === 1){coerced47 = true;}else {const err66 = {instancePath:instancePath+"/attributes/enabled",schemaPath:"attributes.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err66];}else {vErrors.push(err66);}errors++;}}if(coerced47 !== undefined){data62 = coerced47;if(data61 !== undefined){data61["enabled"] = coerced47;}}}}if(data61.value_size_limit !== undefined){let data63 = data61.value_size_limit;if(!((typeof data63 == "number") && (!(data63 % 1) && !isNaN(data63)))){let dataType48 = typeof data63;let coerced48 = undefined;if(!(coerced48 !== undefined)){if(dataType48 === "boolean" || data63 === null
                  || (dataType48 === "string" && data63 && data63 == +data63 && !(data63 % 1))){coerced48 = +data63;}else {const err67 = {instancePath:instancePath+"/attributes/value_size_limit",schemaPath:"attributes.js/properties/value_size_limit/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err67];}else {vErrors.push(err67);}errors++;}}if(coerced48 !== undefined){data63 = coerced48;if(data61 !== undefined){data61["value_size_limit"] = coerced48;}}}if(typeof data63 == "number"){if(data63 > 4096 || isNaN(data63)){const err68 = {instancePath:instancePath+"/attributes/value_size_limit",schemaPath:"attributes.js/properties/value_size_limit/maximum",keyword:"maximum",params:{comparison: "<=", limit: 4096},message:"must be <= 4096"};if(vErrors === null){vErrors = [err68];}else {vErrors.push(err68);}errors++;}}}if(data61.exclude !== undefined){let data64 = data61.exclude;if(Array.isArray(data64)){const len3 = data64.length;for(let i3=0; i3<len3; i3++){let data65 = data64[i3];if(typeof data65 !== "string"){let dataType49 = typeof data65;let coerced49 = undefined;if(!(coerced49 !== undefined)){if(dataType49 == "number" || dataType49 == "boolean"){coerced49 = "" + data65;}else if(data65 === null){coerced49 = "";}else {const err69 = {instancePath:instancePath+"/attributes/exclude/" + i3,schemaPath:"attributes.js/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err69];}else {vErrors.push(err69);}errors++;}}if(coerced49 !== undefined){data65 = coerced49;if(data64 !== undefined){data64[i3] = coerced49;}}}}}else {const err70 = {instancePath:instancePath+"/attributes/exclude",schemaPath:"attributes.js/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err70];}else {vErrors.push(err70);}errors++;}}if(data61.include !== undefined){let data66 = data61.include;if(Array.isArray(data66)){const len4 = data66.length;for(let i4=0; i4<len4; i4++){let data67 = data66[i4];if(typeof data67 !== "string"){let dataType50 = typeof data67;let coerced50 = undefined;if(!(coerced50 !== undefined)){if(dataType50 == "number" || dataType50 == "boolean"){coerced50 = "" + data67;}else if(data67 === null){coerced50 = "";}else {const err71 = {instancePath:instancePath+"/attributes/include/" + i4,schemaPath:"attributes.js/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err71];}else {vErrors.push(err71);}errors++;}}if(coerced50 !== undefined){data67 = coerced50;if(data66 !== undefined){data66[i4] = coerced50;}}}}}else {const err72 = {instancePath:instancePath+"/attributes/include",schemaPath:"attributes.js/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err72];}else {vErrors.push(err72);}errors++;}}if(data61.include_enabled !== undefined){let data68 = data61.include_enabled;if(typeof data68 !== "boolean"){let coerced51 = undefined;if(!(coerced51 !== undefined)){if(data68 === "false" || data68 === 0 || data68 === null){coerced51 = false;}else if(data68 === "true" || data68 === 1){coerced51 = true;}else {const err73 = {instancePath:instancePath+"/attributes/include_enabled",schemaPath:"attributes.js/properties/include_enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err73];}else {vErrors.push(err73);}errors++;}}if(coerced51 !== undefined){data68 = coerced51;if(data61 !== undefined){data61["include_enabled"] = coerced51;}}}}if(data61.filter_cache_limit !== undefined){let data69 = data61.filter_cache_limit;if(!((typeof data69 == "number") && (!(data69 % 1) && !isNaN(data69)))){let dataType52 = typeof data69;let coerced52 = undefined;if(!(coerced52 !== undefined)){if(dataType52 === "boolean" || data69 === null
                  || (dataType52 === "string" && data69 && data69 == +data69 && !(data69 % 1))){coerced52 = +data69;}else {const err74 = {instancePath:instancePath+"/attributes/filter_cache_limit",schemaPath:"attributes.js/properties/filter_cache_limit/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err74];}else {vErrors.push(err74);}errors++;}}if(coerced52 !== undefined){data69 = coerced52;if(data61 !== undefined){data61["filter_cache_limit"] = coerced52;}}}}}else {const err75 = {instancePath:instancePath+"/attributes",schemaPath:"attributes.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err75];}else {vErrors.push(err75);}errors++;}}if(data.audit_log !== undefined){let data70 = data.audit_log;if(data70 && typeof data70 == "object" && !Array.isArray(data70)){if(data70.enabled !== undefined){let data71 = data70.enabled;if(typeof data71 !== "boolean"){let coerced53 = undefined;if(!(coerced53 !== undefined)){if(data71 === "false" || data71 === 0 || data71 === null){coerced53 = false;}else if(data71 === "true" || data71 === 1){coerced53 = true;}else {const err76 = {instancePath:instancePath+"/audit_log/enabled",schemaPath:"audit-log.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err76];}else {vErrors.push(err76);}errors++;}}if(coerced53 !== undefined){data71 = coerced53;if(data70 !== undefined){data70["enabled"] = coerced53;}}}}if(data70.endpoints !== undefined){let data72 = data70.endpoints;if(Array.isArray(data72)){const len5 = data72.length;for(let i5=0; i5<len5; i5++){let data73 = data72[i5];if(typeof data73 !== "string"){let dataType54 = typeof data73;let coerced54 = undefined;if(!(coerced54 !== undefined)){if(dataType54 == "number" || dataType54 == "boolean"){coerced54 = "" + data73;}else if(data73 === null){coerced54 = "";}else {const err77 = {instancePath:instancePath+"/audit_log/endpoints/" + i5,schemaPath:"audit-log.js/properties/endpoints/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err77];}else {vErrors.push(err77);}errors++;}}if(coerced54 !== undefined){data73 = coerced54;if(data72 !== undefined){data72[i5] = coerced54;}}}}}else {const err78 = {instancePath:instancePath+"/audit_log/endpoints",schemaPath:"audit-log.js/properties/endpoints/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err78];}else {vErrors.push(err78);}errors++;}}}else {const err79 = {instancePath:instancePath+"/audit_log",schemaPath:"audit-log.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err79];}else {vErrors.push(err79);}errors++;}}if(data.browser_monitoring !== undefined){let data74 = data.browser_monitoring;if(data74 && typeof data74 == "object" && !Array.isArray(data74)){if(data74.attributes !== undefined){let data75 = data74.attributes;if(data75 && typeof data75 == "object" && !Array.isArray(data75)){if(data75.enabled !== undefined){let data76 = data75.enabled;if(typeof data76 !== "boolean"){let coerced55 = undefined;if(!(coerced55 !== undefined)){if(data76 === "false" || data76 === 0 || data76 === null){coerced55 = false;}else if(data76 === "true" || data76 === 1){coerced55 = true;}else {const err80 = {instancePath:instancePath+"/browser_monitoring/attributes/enabled",schemaPath:"browser-monitoring.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err80];}else {vErrors.push(err80);}errors++;}}if(coerced55 !== undefined){data76 = coerced55;if(data75 !== undefined){data75["enabled"] = coerced55;}}}}if(data75.exclude !== undefined){let data77 = data75.exclude;if(Array.isArray(data77)){const len6 = data77.length;for(let i6=0; i6<len6; i6++){let data78 = data77[i6];if(typeof data78 !== "string"){let dataType56 = typeof data78;let coerced56 = undefined;if(!(coerced56 !== undefined)){if(dataType56 == "number" || dataType56 == "boolean"){coerced56 = "" + data78;}else if(data78 === null){coerced56 = "";}else {const err81 = {instancePath:instancePath+"/browser_monitoring/attributes/exclude/" + i6,schemaPath:"browser-monitoring.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err81];}else {vErrors.push(err81);}errors++;}}if(coerced56 !== undefined){data78 = coerced56;if(data77 !== undefined){data77[i6] = coerced56;}}}}}else {const err82 = {instancePath:instancePath+"/browser_monitoring/attributes/exclude",schemaPath:"browser-monitoring.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err82];}else {vErrors.push(err82);}errors++;}}if(data75.include !== undefined){let data79 = data75.include;if(Array.isArray(data79)){const len7 = data79.length;for(let i7=0; i7<len7; i7++){let data80 = data79[i7];if(typeof data80 !== "string"){let dataType57 = typeof data80;let coerced57 = undefined;if(!(coerced57 !== undefined)){if(dataType57 == "number" || dataType57 == "boolean"){coerced57 = "" + data80;}else if(data80 === null){coerced57 = "";}else {const err83 = {instancePath:instancePath+"/browser_monitoring/attributes/include/" + i7,schemaPath:"browser-monitoring.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err83];}else {vErrors.push(err83);}errors++;}}if(coerced57 !== undefined){data80 = coerced57;if(data79 !== undefined){data79[i7] = coerced57;}}}}}else {const err84 = {instancePath:instancePath+"/browser_monitoring/attributes/include",schemaPath:"browser-monitoring.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err84];}else {vErrors.push(err84);}errors++;}}}else {const err85 = {instancePath:instancePath+"/browser_monitoring/attributes",schemaPath:"browser-monitoring.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err85];}else {vErrors.push(err85);}errors++;}}if(data74.enable !== undefined){let data81 = data74.enable;if(typeof data81 !== "boolean"){let coerced58 = undefined;if(!(coerced58 !== undefined)){if(data81 === "false" || data81 === 0 || data81 === null){coerced58 = false;}else if(data81 === "true" || data81 === 1){coerced58 = true;}else {const err86 = {instancePath:instancePath+"/browser_monitoring/enable",schemaPath:"browser-monitoring.js/properties/enable/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err86];}else {vErrors.push(err86);}errors++;}}if(coerced58 !== undefined){data81 = coerced58;if(data74 !== undefined){data74["enable"] = coerced58;}}}}if(data74.debug !== undefined){let data82 = data74.debug;if(typeof data82 !== "boolean"){let coerced59 = undefined;if(!(coerced59 !== undefined)){if(data82 === "false" || data82 === 0 || data82 === null){coerced59 = false;}else if(data82 === "true" || data82 === 1){coerced59 = true;}else {const err87 = {instancePath:instancePath+"/browser_monitoring/debug",schemaPath:"browser-monitoring.js/properties/debug/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err87];}else {vErrors.push(err87);}errors++;}}if(coerced59 !== undefined){data82 = coerced59;if(data74 !== undefined){data74["debug"] = coerced59;}}}}if(data74.version !== undefined){let data83 = data74.version;if(typeof data83 !== "string"){let dataType60 = typeof data83;let coerced60 = undefined;if(!(coerced60 !== undefined)){if(dataType60 == "number" || dataType60 == "boolean"){coerced60 = "" + data83;}else if(data83 === null){coerced60 = "";}else {const err88 = {instancePath:instancePath+"/browser_monitoring/version",schemaPath:"browser-monitoring.js/properties/version/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err88];}else {vErrors.push(err88);}errors++;}}if(coerced60 !== undefined){data83 = coerced60;if(data74 !== undefined){data74["version"] = coerced60;}}}}}else {const err89 = {instancePath:instancePath+"/browser_monitoring",schemaPath:"browser-monitoring.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err89];}else {vErrors.push(err89);}errors++;}}if(data.cloud !== undefined){let data84 = data.cloud;if(data84 && typeof data84 == "object" && !Array.isArray(data84)){if(data84.aws !== undefined){let data85 = data84.aws;if(data85 && typeof data85 == "object" && !Array.isArray(data85)){if(data85.account_id !== undefined){let data86 = data85.account_id;if(!((typeof data86 == "number") && (!(data86 % 1) && !isNaN(data86)))){let dataType61 = typeof data86;let coerced61 = undefined;if(!(coerced61 !== undefined)){if(dataType61 === "boolean" || data86 === null
                  || (dataType61 === "string" && data86 && data86 == +data86 && !(data86 % 1))){coerced61 = +data86;}else {const err90 = {instancePath:instancePath+"/cloud/aws/account_id",schemaPath:"cloud.js/properties/aws/properties/account_id/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err90];}else {vErrors.push(err90);}errors++;}}if(coerced61 !== undefined){data86 = coerced61;if(data85 !== undefined){data85["account_id"] = coerced61;}}}}}else {const err91 = {instancePath:instancePath+"/cloud/aws",schemaPath:"cloud.js/properties/aws/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err91];}else {vErrors.push(err91);}errors++;}}}else {const err92 = {instancePath:instancePath+"/cloud",schemaPath:"cloud.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err92];}else {vErrors.push(err92);}errors++;}}if(data.code_level_metrics !== undefined){let data87 = data.code_level_metrics;if(data87 && typeof data87 == "object" && !Array.isArray(data87)){if(data87.enabled !== undefined){let data88 = data87.enabled;if(typeof data88 !== "boolean"){let coerced62 = undefined;if(!(coerced62 !== undefined)){if(data88 === "false" || data88 === 0 || data88 === null){coerced62 = false;}else if(data88 === "true" || data88 === 1){coerced62 = true;}else {const err93 = {instancePath:instancePath+"/code_level_metrics/enabled",schemaPath:"code-level-metrics.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err93];}else {vErrors.push(err93);}errors++;}}if(coerced62 !== undefined){data88 = coerced62;if(data87 !== undefined){data87["enabled"] = coerced62;}}}}}else {const err94 = {instancePath:instancePath+"/code_level_metrics",schemaPath:"code-level-metrics.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err94];}else {vErrors.push(err94);}errors++;}}if(data.custom_insights_events !== undefined){let data89 = data.custom_insights_events;if(data89 && typeof data89 == "object" && !Array.isArray(data89)){if(data89.enabled !== undefined){let data90 = data89.enabled;if(typeof data90 !== "boolean"){let coerced63 = undefined;if(!(coerced63 !== undefined)){if(data90 === "false" || data90 === 0 || data90 === null){coerced63 = false;}else if(data90 === "true" || data90 === 1){coerced63 = true;}else {const err95 = {instancePath:instancePath+"/custom_insights_events/enabled",schemaPath:"custom-insights-events.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err95];}else {vErrors.push(err95);}errors++;}}if(coerced63 !== undefined){data90 = coerced63;if(data89 !== undefined){data89["enabled"] = coerced63;}}}}if(data89.max_samples_stored !== undefined){let data91 = data89.max_samples_stored;if(!((typeof data91 == "number") && (!(data91 % 1) && !isNaN(data91)))){let dataType64 = typeof data91;let coerced64 = undefined;if(!(coerced64 !== undefined)){if(dataType64 === "boolean" || data91 === null
                  || (dataType64 === "string" && data91 && data91 == +data91 && !(data91 % 1))){coerced64 = +data91;}else {const err96 = {instancePath:instancePath+"/custom_insights_events/max_samples_stored",schemaPath:"custom-insights-events.js/properties/max_samples_stored/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err96];}else {vErrors.push(err96);}errors++;}}if(coerced64 !== undefined){data91 = coerced64;if(data89 !== undefined){data89["max_samples_stored"] = coerced64;}}}}}else {const err97 = {instancePath:instancePath+"/custom_insights_events",schemaPath:"custom-insights-events.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err97];}else {vErrors.push(err97);}errors++;}}if(data.datastore_tracer !== undefined){let data92 = data.datastore_tracer;if(data92 && typeof data92 == "object" && !Array.isArray(data92)){if(data92.instance_reporting !== undefined){let data93 = data92.instance_reporting;if(data93 && typeof data93 == "object" && !Array.isArray(data93)){if(data93.enabled !== undefined){let data94 = data93.enabled;if(typeof data94 !== "boolean"){let coerced65 = undefined;if(!(coerced65 !== undefined)){if(data94 === "false" || data94 === 0 || data94 === null){coerced65 = false;}else if(data94 === "true" || data94 === 1){coerced65 = true;}else {const err98 = {instancePath:instancePath+"/datastore_tracer/instance_reporting/enabled",schemaPath:"datastore-tracer.js/properties/instance_reporting/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err98];}else {vErrors.push(err98);}errors++;}}if(coerced65 !== undefined){data94 = coerced65;if(data93 !== undefined){data93["enabled"] = coerced65;}}}}}else {const err99 = {instancePath:instancePath+"/datastore_tracer/instance_reporting",schemaPath:"datastore-tracer.js/properties/instance_reporting/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err99];}else {vErrors.push(err99);}errors++;}}if(data92.database_name_reporting !== undefined){let data95 = data92.database_name_reporting;if(data95 && typeof data95 == "object" && !Array.isArray(data95)){if(data95.enabled !== undefined){let data96 = data95.enabled;if(typeof data96 !== "boolean"){let coerced66 = undefined;if(!(coerced66 !== undefined)){if(data96 === "false" || data96 === 0 || data96 === null){coerced66 = false;}else if(data96 === "true" || data96 === 1){coerced66 = true;}else {const err100 = {instancePath:instancePath+"/datastore_tracer/database_name_reporting/enabled",schemaPath:"datastore-tracer.js/properties/database_name_reporting/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err100];}else {vErrors.push(err100);}errors++;}}if(coerced66 !== undefined){data96 = coerced66;if(data95 !== undefined){data95["enabled"] = coerced66;}}}}}else {const err101 = {instancePath:instancePath+"/datastore_tracer/database_name_reporting",schemaPath:"datastore-tracer.js/properties/database_name_reporting/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err101];}else {vErrors.push(err101);}errors++;}}}else {const err102 = {instancePath:instancePath+"/datastore_tracer",schemaPath:"datastore-tracer.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err102];}else {vErrors.push(err102);}errors++;}}if(data.distributed_tracing !== undefined){let data97 = data.distributed_tracing;if(data97 && typeof data97 == "object" && !Array.isArray(data97)){if(data97.enabled !== undefined){let data98 = data97.enabled;if(typeof data98 !== "boolean"){let coerced67 = undefined;if(!(coerced67 !== undefined)){if(data98 === "false" || data98 === 0 || data98 === null){coerced67 = false;}else if(data98 === "true" || data98 === 1){coerced67 = true;}else {const err103 = {instancePath:instancePath+"/distributed_tracing/enabled",schemaPath:"distributed-tracing.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err103];}else {vErrors.push(err103);}errors++;}}if(coerced67 !== undefined){data98 = coerced67;if(data97 !== undefined){data97["enabled"] = coerced67;}}}}if(data97.exclude_newrelic_header !== undefined){let data99 = data97.exclude_newrelic_header;if(typeof data99 !== "boolean"){let coerced68 = undefined;if(!(coerced68 !== undefined)){if(data99 === "false" || data99 === 0 || data99 === null){coerced68 = false;}else if(data99 === "true" || data99 === 1){coerced68 = true;}else {const err104 = {instancePath:instancePath+"/distributed_tracing/exclude_newrelic_header",schemaPath:"distributed-tracing.js/properties/exclude_newrelic_header/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err104];}else {vErrors.push(err104);}errors++;}}if(coerced68 !== undefined){data99 = coerced68;if(data97 !== undefined){data97["exclude_newrelic_header"] = coerced68;}}}}if(data97.sampler !== undefined){let data100 = data97.sampler;if(data100 && typeof data100 == "object" && !Array.isArray(data100)){if(data100.root !== undefined){let data101 = data100.root;const _errs251 = errors;let valid57 = false;let passing2 = null;const _errs252 = errors;if(typeof data101 !== "string"){let dataType69 = typeof data101;let coerced69 = undefined;if(!(coerced69 !== undefined)){if(dataType69 == "number" || dataType69 == "boolean"){coerced69 = "" + data101;}else if(data101 === null){coerced69 = "";}else {const err105 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err105];}else {vErrors.push(err105);}errors++;}}if(coerced69 !== undefined){data101 = coerced69;if(data100 !== undefined){data100["root"] = coerced69;}}}if(!(((data101 === "always_on") || (data101 === "always_off")) || (data101 === "adaptive"))){const err106 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.root.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err106];}else {vErrors.push(err106);}errors++;}var _valid2 = _errs252 === errors;if(_valid2){valid57 = true;passing2 = 0;}const _errs254 = errors;if(data101 && typeof data101 == "object" && !Array.isArray(data101)){if(data101.trace_id_ratio_based === undefined){const err107 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err107];}else {vErrors.push(err107);}errors++;}if(data101.trace_id_ratio_based !== undefined){let data102 = data101.trace_id_ratio_based;if(data102 && typeof data102 == "object" && !Array.isArray(data102)){if(data102.ratio === undefined){const err108 = {instancePath:instancePath+"/distributed_tracing/sampler/root/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err108];}else {vErrors.push(err108);}errors++;}if(data102.ratio !== undefined){let data103 = data102.ratio;if(!(typeof data103 == "number")){let dataType70 = typeof data103;let coerced70 = undefined;if(!(coerced70 !== undefined)){if(dataType70 == "boolean" || data103 === null
                  || (dataType70 == "string" && data103 && data103 == +data103)){coerced70 = +data103;}else {const err109 = {instancePath:instancePath+"/distributed_tracing/sampler/root/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err109];}else {vErrors.push(err109);}errors++;}}if(coerced70 !== undefined){data103 = coerced70;if(data102 !== undefined){data102["ratio"] = coerced70;}}}}}else {const err110 = {instancePath:instancePath+"/distributed_tracing/sampler/root/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err110];}else {vErrors.push(err110);}errors++;}}}else {const err111 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err111];}else {vErrors.push(err111);}errors++;}var _valid2 = _errs254 === errors;if(_valid2 && valid57){valid57 = false;passing2 = [passing2, 1];}else {if(_valid2){valid57 = true;passing2 = 1;var props0 = true;}const _errs262 = errors;if(data101 && typeof data101 == "object" && !Array.isArray(data101)){if(data101.adaptive === undefined){const err112 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err112];}else {vErrors.push(err112);}errors++;}if(data101.adaptive !== undefined){let data104 = data101.adaptive;if(data104 && typeof data104 == "object" && !Array.isArray(data104)){if(data104.sampling_target !== undefined){let data105 = data104.sampling_target;if(!((typeof data105 == "number") && (!(data105 % 1) && !isNaN(data105)))){let dataType71 = typeof data105;let coerced71 = undefined;if(!(coerced71 !== undefined)){if(dataType71 === "boolean" || data105 === null
                  || (dataType71 === "string" && data105 && data105 == +data105 && !(data105 % 1))){coerced71 = +data105;}else {const err113 = {instancePath:instancePath+"/distributed_tracing/sampler/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err113];}else {vErrors.push(err113);}errors++;}}if(coerced71 !== undefined){data105 = coerced71;if(data104 !== undefined){data104["sampling_target"] = coerced71;}}}if(typeof data105 == "number"){if(data105 > 120 || isNaN(data105)){const err114 = {instancePath:instancePath+"/distributed_tracing/sampler/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err114];}else {vErrors.push(err114);}errors++;}if(data105 < 1 || isNaN(data105)){const err115 = {instancePath:instancePath+"/distributed_tracing/sampler/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err115];}else {vErrors.push(err115);}errors++;}}}}else {const err116 = {instancePath:instancePath+"/distributed_tracing/sampler/root/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err116];}else {vErrors.push(err116);}errors++;}}}else {const err117 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err117];}else {vErrors.push(err117);}errors++;}var _valid2 = _errs262 === errors;if(_valid2 && valid57){valid57 = false;passing2 = [passing2, 2];}else {if(_valid2){valid57 = true;passing2 = 2;if(props0 !== true){props0 = true;}}}}if(!valid57){const err118 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf",keyword:"oneOf",params:{passingSchemas: passing2},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err118];}else {vErrors.push(err118);}errors++;}else {errors = _errs251;if(vErrors !== null){if(_errs251){vErrors.length = _errs251;}else {vErrors = null;}}}}if(data100.remote_parent_sampled !== undefined){let data106 = data100.remote_parent_sampled;const _errs271 = errors;let valid62 = false;let passing3 = null;const _errs272 = errors;if(typeof data106 !== "string"){let dataType72 = typeof data106;let coerced72 = undefined;if(!(coerced72 !== undefined)){if(dataType72 == "number" || dataType72 == "boolean"){coerced72 = "" + data106;}else if(data106 === null){coerced72 = "";}else {const err119 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err119];}else {vErrors.push(err119);}errors++;}}if(coerced72 !== undefined){data106 = coerced72;if(data100 !== undefined){data100["remote_parent_sampled"] = coerced72;}}}if(!(((data106 === "always_on") || (data106 === "always_off")) || (data106 === "adaptive"))){const err120 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.remote_parent_sampled.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err120];}else {vErrors.push(err120);}errors++;}var _valid3 = _errs272 === errors;if(_valid3){valid62 = true;passing3 = 0;}const _errs274 = errors;if(data106 && typeof data106 == "object" && !Array.isArray(data106)){if(data106.trace_id_ratio_based === undefined){const err121 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err121];}else {vErrors.push(err121);}errors++;}if(data106.trace_id_ratio_based !== undefined){let data107 = data106.trace_id_ratio_based;if(data107 && typeof data107 == "object" && !Array.isArray(data107)){if(data107.ratio === undefined){const err122 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err122];}else {vErrors.push(err122);}errors++;}if(data107.ratio !== undefined){let data108 = data107.ratio;if(!(typeof data108 == "number")){let dataType73 = typeof data108;let coerced73 = undefined;if(!(coerced73 !== undefined)){if(dataType73 == "boolean" || data108 === null
                  || (dataType73 == "string" && data108 && data108 == +data108)){coerced73 = +data108;}else {const err123 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err123];}else {vErrors.push(err123);}errors++;}}if(coerced73 !== undefined){data108 = coerced73;if(data107 !== undefined){data107["ratio"] = coerced73;}}}}}else {const err124 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err124];}else {vErrors.push(err124);}errors++;}}}else {const err125 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err125];}else {vErrors.push(err125);}errors++;}var _valid3 = _errs274 === errors;if(_valid3 && valid62){valid62 = false;passing3 = [passing3, 1];}else {if(_valid3){valid62 = true;passing3 = 1;var props1 = true;}const _errs282 = errors;if(data106 && typeof data106 == "object" && !Array.isArray(data106)){if(data106.adaptive === undefined){const err126 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err126];}else {vErrors.push(err126);}errors++;}if(data106.adaptive !== undefined){let data109 = data106.adaptive;if(data109 && typeof data109 == "object" && !Array.isArray(data109)){if(data109.sampling_target !== undefined){let data110 = data109.sampling_target;if(!((typeof data110 == "number") && (!(data110 % 1) && !isNaN(data110)))){let dataType74 = typeof data110;let coerced74 = undefined;if(!(coerced74 !== undefined)){if(dataType74 === "boolean" || data110 === null
                  || (dataType74 === "string" && data110 && data110 == +data110 && !(data110 % 1))){coerced74 = +data110;}else {const err127 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err127];}else {vErrors.push(err127);}errors++;}}if(coerced74 !== undefined){data110 = coerced74;if(data109 !== undefined){data109["sampling_target"] = coerced74;}}}if(typeof data110 == "number"){if(data110 > 120 || isNaN(data110)){const err128 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err128];}else {vErrors.push(err128);}errors++;}if(data110 < 1 || isNaN(data110)){const err129 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err129];}else {vErrors.push(err129);}errors++;}}}}else {const err130 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err130];}else {vErrors.push(err130);}errors++;}}}else {const err131 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err131];}else {vErrors.push(err131);}errors++;}var _valid3 = _errs282 === errors;if(_valid3 && valid62){valid62 = false;passing3 = [passing3, 2];}else {if(_valid3){valid62 = true;passing3 = 2;if(props1 !== true){props1 = true;}}}}if(!valid62){const err132 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf",keyword:"oneOf",params:{passingSchemas: passing3},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err132];}else {vErrors.push(err132);}errors++;}else {errors = _errs271;if(vErrors !== null){if(_errs271){vErrors.length = _errs271;}else {vErrors = null;}}}}if(data100.remote_parent_not_sampled !== undefined){let data111 = data100.remote_parent_not_sampled;const _errs291 = errors;let valid67 = false;let passing4 = null;const _errs292 = errors;if(typeof data111 !== "string"){let dataType75 = typeof data111;let coerced75 = undefined;if(!(coerced75 !== undefined)){if(dataType75 == "number" || dataType75 == "boolean"){coerced75 = "" + data111;}else if(data111 === null){coerced75 = "";}else {const err133 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err133];}else {vErrors.push(err133);}errors++;}}if(coerced75 !== undefined){data111 = coerced75;if(data100 !== undefined){data100["remote_parent_not_sampled"] = coerced75;}}}if(!(((data111 === "always_on") || (data111 === "always_off")) || (data111 === "adaptive"))){const err134 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.remote_parent_not_sampled.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err134];}else {vErrors.push(err134);}errors++;}var _valid4 = _errs292 === errors;if(_valid4){valid67 = true;passing4 = 0;}const _errs294 = errors;if(data111 && typeof data111 == "object" && !Array.isArray(data111)){if(data111.trace_id_ratio_based === undefined){const err135 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err135];}else {vErrors.push(err135);}errors++;}if(data111.trace_id_ratio_based !== undefined){let data112 = data111.trace_id_ratio_based;if(data112 && typeof data112 == "object" && !Array.isArray(data112)){if(data112.ratio === undefined){const err136 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err136];}else {vErrors.push(err136);}errors++;}if(data112.ratio !== undefined){let data113 = data112.ratio;if(!(typeof data113 == "number")){let dataType76 = typeof data113;let coerced76 = undefined;if(!(coerced76 !== undefined)){if(dataType76 == "boolean" || data113 === null
                  || (dataType76 == "string" && data113 && data113 == +data113)){coerced76 = +data113;}else {const err137 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err137];}else {vErrors.push(err137);}errors++;}}if(coerced76 !== undefined){data113 = coerced76;if(data112 !== undefined){data112["ratio"] = coerced76;}}}}}else {const err138 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err138];}else {vErrors.push(err138);}errors++;}}}else {const err139 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err139];}else {vErrors.push(err139);}errors++;}var _valid4 = _errs294 === errors;if(_valid4 && valid67){valid67 = false;passing4 = [passing4, 1];}else {if(_valid4){valid67 = true;passing4 = 1;var props2 = true;}const _errs302 = errors;if(data111 && typeof data111 == "object" && !Array.isArray(data111)){if(data111.adaptive === undefined){const err140 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err140];}else {vErrors.push(err140);}errors++;}if(data111.adaptive !== undefined){let data114 = data111.adaptive;if(data114 && typeof data114 == "object" && !Array.isArray(data114)){if(data114.sampling_target !== undefined){let data115 = data114.sampling_target;if(!((typeof data115 == "number") && (!(data115 % 1) && !isNaN(data115)))){let dataType77 = typeof data115;let coerced77 = undefined;if(!(coerced77 !== undefined)){if(dataType77 === "boolean" || data115 === null
                  || (dataType77 === "string" && data115 && data115 == +data115 && !(data115 % 1))){coerced77 = +data115;}else {const err141 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err141];}else {vErrors.push(err141);}errors++;}}if(coerced77 !== undefined){data115 = coerced77;if(data114 !== undefined){data114["sampling_target"] = coerced77;}}}if(typeof data115 == "number"){if(data115 > 120 || isNaN(data115)){const err142 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err142];}else {vErrors.push(err142);}errors++;}if(data115 < 1 || isNaN(data115)){const err143 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err143];}else {vErrors.push(err143);}errors++;}}}}else {const err144 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err144];}else {vErrors.push(err144);}errors++;}}}else {const err145 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err145];}else {vErrors.push(err145);}errors++;}var _valid4 = _errs302 === errors;if(_valid4 && valid67){valid67 = false;passing4 = [passing4, 2];}else {if(_valid4){valid67 = true;passing4 = 2;if(props2 !== true){props2 = true;}}}}if(!valid67){const err146 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf",keyword:"oneOf",params:{passingSchemas: passing4},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err146];}else {vErrors.push(err146);}errors++;}else {errors = _errs291;if(vErrors !== null){if(_errs291){vErrors.length = _errs291;}else {vErrors = null;}}}}if(data100.adaptive_sampling_target !== undefined){let data116 = data100.adaptive_sampling_target;if(!((typeof data116 == "number") && (!(data116 % 1) && !isNaN(data116)))){let dataType78 = typeof data116;let coerced78 = undefined;if(!(coerced78 !== undefined)){if(dataType78 === "boolean" || data116 === null
                  || (dataType78 === "string" && data116 && data116 == +data116 && !(data116 % 1))){coerced78 = +data116;}else {const err147 = {instancePath:instancePath+"/distributed_tracing/sampler/adaptive_sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/adaptive_sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err147];}else {vErrors.push(err147);}errors++;}}if(coerced78 !== undefined){data116 = coerced78;if(data100 !== undefined){data100["adaptive_sampling_target"] = coerced78;}}}if(typeof data116 == "number"){if(data116 > 120 || isNaN(data116)){const err148 = {instancePath:instancePath+"/distributed_tracing/sampler/adaptive_sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/adaptive_sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err148];}else {vErrors.push(err148);}errors++;}if(data116 < 1 || isNaN(data116)){const err149 = {instancePath:instancePath+"/distributed_tracing/sampler/adaptive_sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/adaptive_sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err149];}else {vErrors.push(err149);}errors++;}}}if(data100.full_granularity !== undefined){let data117 = data100.full_granularity;if(data117 && typeof data117 == "object" && !Array.isArray(data117)){if(data117.enabled !== undefined){let data118 = data117.enabled;if(typeof data118 !== "boolean"){let coerced79 = undefined;if(!(coerced79 !== undefined)){if(data118 === "false" || data118 === 0 || data118 === null){coerced79 = false;}else if(data118 === "true" || data118 === 1){coerced79 = true;}else {const err150 = {instancePath:instancePath+"/distributed_tracing/sampler/full_granularity/enabled",schemaPath:"distributed-tracing.js/properties/sampler/properties/full_granularity/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err150];}else {vErrors.push(err150);}errors++;}}if(coerced79 !== undefined){data118 = coerced79;if(data117 !== undefined){data117["enabled"] = coerced79;}}}}}else {const err151 = {instancePath:instancePath+"/distributed_tracing/sampler/full_granularity",schemaPath:"distributed-tracing.js/properties/sampler/properties/full_granularity/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err151];}else {vErrors.push(err151);}errors++;}}if(data100.partial_granularity !== undefined){let data119 = data100.partial_granularity;if(data119 && typeof data119 == "object" && !Array.isArray(data119)){if(data119.enabled !== undefined){let data120 = data119.enabled;if(typeof data120 !== "boolean"){let coerced80 = undefined;if(!(coerced80 !== undefined)){if(data120 === "false" || data120 === 0 || data120 === null){coerced80 = false;}else if(data120 === "true" || data120 === 1){coerced80 = true;}else {const err152 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/enabled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err152];}else {vErrors.push(err152);}errors++;}}if(coerced80 !== undefined){data120 = coerced80;if(data119 !== undefined){data119["enabled"] = coerced80;}}}}if(data119.type !== undefined){let data121 = data119.type;if(typeof data121 !== "string"){let dataType81 = typeof data121;let coerced81 = undefined;if(!(coerced81 !== undefined)){if(dataType81 == "number" || dataType81 == "boolean"){coerced81 = "" + data121;}else if(data121 === null){coerced81 = "";}else {const err153 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/type",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/type/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err153];}else {vErrors.push(err153);}errors++;}}if(coerced81 !== undefined){data121 = coerced81;if(data119 !== undefined){data119["type"] = coerced81;}}}if(!(((data121 === "compact") || (data121 === "essential")) || (data121 === "reduced"))){const err154 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/type",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/type/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.partial_granularity.properties.type.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err154];}else {vErrors.push(err154);}errors++;}}if(data119.root !== undefined){let data122 = data119.root;const _errs325 = errors;let valid74 = false;let passing5 = null;const _errs326 = errors;if(typeof data122 !== "string"){let dataType82 = typeof data122;let coerced82 = undefined;if(!(coerced82 !== undefined)){if(dataType82 == "number" || dataType82 == "boolean"){coerced82 = "" + data122;}else if(data122 === null){coerced82 = "";}else {const err155 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err155];}else {vErrors.push(err155);}errors++;}}if(coerced82 !== undefined){data122 = coerced82;if(data119 !== undefined){data119["root"] = coerced82;}}}if(!(((data122 === "always_on") || (data122 === "always_off")) || (data122 === "adaptive"))){const err156 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.partial_granularity.properties.root.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err156];}else {vErrors.push(err156);}errors++;}var _valid5 = _errs326 === errors;if(_valid5){valid74 = true;passing5 = 0;}const _errs328 = errors;if(data122 && typeof data122 == "object" && !Array.isArray(data122)){if(data122.trace_id_ratio_based === undefined){const err157 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err157];}else {vErrors.push(err157);}errors++;}if(data122.trace_id_ratio_based !== undefined){let data123 = data122.trace_id_ratio_based;if(data123 && typeof data123 == "object" && !Array.isArray(data123)){if(data123.ratio === undefined){const err158 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err158];}else {vErrors.push(err158);}errors++;}if(data123.ratio !== undefined){let data124 = data123.ratio;if(!(typeof data124 == "number")){let dataType83 = typeof data124;let coerced83 = undefined;if(!(coerced83 !== undefined)){if(dataType83 == "boolean" || data124 === null
                  || (dataType83 == "string" && data124 && data124 == +data124)){coerced83 = +data124;}else {const err159 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err159];}else {vErrors.push(err159);}errors++;}}if(coerced83 !== undefined){data124 = coerced83;if(data123 !== undefined){data123["ratio"] = coerced83;}}}}}else {const err160 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err160];}else {vErrors.push(err160);}errors++;}}}else {const err161 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err161];}else {vErrors.push(err161);}errors++;}var _valid5 = _errs328 === errors;if(_valid5 && valid74){valid74 = false;passing5 = [passing5, 1];}else {if(_valid5){valid74 = true;passing5 = 1;var props3 = true;}const _errs336 = errors;if(data122 && typeof data122 == "object" && !Array.isArray(data122)){if(data122.adaptive === undefined){const err162 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err162];}else {vErrors.push(err162);}errors++;}if(data122.adaptive !== undefined){let data125 = data122.adaptive;if(data125 && typeof data125 == "object" && !Array.isArray(data125)){if(data125.sampling_target !== undefined){let data126 = data125.sampling_target;if(!((typeof data126 == "number") && (!(data126 % 1) && !isNaN(data126)))){let dataType84 = typeof data126;let coerced84 = undefined;if(!(coerced84 !== undefined)){if(dataType84 === "boolean" || data126 === null
                  || (dataType84 === "string" && data126 && data126 == +data126 && !(data126 % 1))){coerced84 = +data126;}else {const err163 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err163];}else {vErrors.push(err163);}errors++;}}if(coerced84 !== undefined){data126 = coerced84;if(data125 !== undefined){data125["sampling_target"] = coerced84;}}}if(typeof data126 == "number"){if(data126 > 120 || isNaN(data126)){const err164 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err164];}else {vErrors.push(err164);}errors++;}if(data126 < 1 || isNaN(data126)){const err165 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err165];}else {vErrors.push(err165);}errors++;}}}}else {const err166 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err166];}else {vErrors.push(err166);}errors++;}}}else {const err167 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err167];}else {vErrors.push(err167);}errors++;}var _valid5 = _errs336 === errors;if(_valid5 && valid74){valid74 = false;passing5 = [passing5, 2];}else {if(_valid5){valid74 = true;passing5 = 2;if(props3 !== true){props3 = true;}}}}if(!valid74){const err168 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf",keyword:"oneOf",params:{passingSchemas: passing5},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err168];}else {vErrors.push(err168);}errors++;}else {errors = _errs325;if(vErrors !== null){if(_errs325){vErrors.length = _errs325;}else {vErrors = null;}}}}if(data119.remote_parent_sampled !== undefined){let data127 = data119.remote_parent_sampled;const _errs345 = errors;let valid79 = false;let passing6 = null;const _errs346 = errors;if(typeof data127 !== "string"){let dataType85 = typeof data127;let coerced85 = undefined;if(!(coerced85 !== undefined)){if(dataType85 == "number" || dataType85 == "boolean"){coerced85 = "" + data127;}else if(data127 === null){coerced85 = "";}else {const err169 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err169];}else {vErrors.push(err169);}errors++;}}if(coerced85 !== undefined){data127 = coerced85;if(data119 !== undefined){data119["remote_parent_sampled"] = coerced85;}}}if(!(((data127 === "always_on") || (data127 === "always_off")) || (data127 === "adaptive"))){const err170 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.partial_granularity.properties.remote_parent_sampled.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err170];}else {vErrors.push(err170);}errors++;}var _valid6 = _errs346 === errors;if(_valid6){valid79 = true;passing6 = 0;}const _errs348 = errors;if(data127 && typeof data127 == "object" && !Array.isArray(data127)){if(data127.trace_id_ratio_based === undefined){const err171 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err171];}else {vErrors.push(err171);}errors++;}if(data127.trace_id_ratio_based !== undefined){let data128 = data127.trace_id_ratio_based;if(data128 && typeof data128 == "object" && !Array.isArray(data128)){if(data128.ratio === undefined){const err172 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err172];}else {vErrors.push(err172);}errors++;}if(data128.ratio !== undefined){let data129 = data128.ratio;if(!(typeof data129 == "number")){let dataType86 = typeof data129;let coerced86 = undefined;if(!(coerced86 !== undefined)){if(dataType86 == "boolean" || data129 === null
                  || (dataType86 == "string" && data129 && data129 == +data129)){coerced86 = +data129;}else {const err173 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err173];}else {vErrors.push(err173);}errors++;}}if(coerced86 !== undefined){data129 = coerced86;if(data128 !== undefined){data128["ratio"] = coerced86;}}}}}else {const err174 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err174];}else {vErrors.push(err174);}errors++;}}}else {const err175 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err175];}else {vErrors.push(err175);}errors++;}var _valid6 = _errs348 === errors;if(_valid6 && valid79){valid79 = false;passing6 = [passing6, 1];}else {if(_valid6){valid79 = true;passing6 = 1;var props4 = true;}const _errs356 = errors;if(data127 && typeof data127 == "object" && !Array.isArray(data127)){if(data127.adaptive === undefined){const err176 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err176];}else {vErrors.push(err176);}errors++;}if(data127.adaptive !== undefined){let data130 = data127.adaptive;if(data130 && typeof data130 == "object" && !Array.isArray(data130)){if(data130.sampling_target !== undefined){let data131 = data130.sampling_target;if(!((typeof data131 == "number") && (!(data131 % 1) && !isNaN(data131)))){let dataType87 = typeof data131;let coerced87 = undefined;if(!(coerced87 !== undefined)){if(dataType87 === "boolean" || data131 === null
                  || (dataType87 === "string" && data131 && data131 == +data131 && !(data131 % 1))){coerced87 = +data131;}else {const err177 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err177];}else {vErrors.push(err177);}errors++;}}if(coerced87 !== undefined){data131 = coerced87;if(data130 !== undefined){data130["sampling_target"] = coerced87;}}}if(typeof data131 == "number"){if(data131 > 120 || isNaN(data131)){const err178 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err178];}else {vErrors.push(err178);}errors++;}if(data131 < 1 || isNaN(data131)){const err179 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err179];}else {vErrors.push(err179);}errors++;}}}}else {const err180 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err180];}else {vErrors.push(err180);}errors++;}}}else {const err181 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err181];}else {vErrors.push(err181);}errors++;}var _valid6 = _errs356 === errors;if(_valid6 && valid79){valid79 = false;passing6 = [passing6, 2];}else {if(_valid6){valid79 = true;passing6 = 2;if(props4 !== true){props4 = true;}}}}if(!valid79){const err182 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf",keyword:"oneOf",params:{passingSchemas: passing6},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err182];}else {vErrors.push(err182);}errors++;}else {errors = _errs345;if(vErrors !== null){if(_errs345){vErrors.length = _errs345;}else {vErrors = null;}}}}if(data119.remote_parent_not_sampled !== undefined){let data132 = data119.remote_parent_not_sampled;const _errs365 = errors;let valid84 = false;let passing7 = null;const _errs366 = errors;if(typeof data132 !== "string"){let dataType88 = typeof data132;let coerced88 = undefined;if(!(coerced88 !== undefined)){if(dataType88 == "number" || dataType88 == "boolean"){coerced88 = "" + data132;}else if(data132 === null){coerced88 = "";}else {const err183 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err183];}else {vErrors.push(err183);}errors++;}}if(coerced88 !== undefined){data132 = coerced88;if(data119 !== undefined){data119["remote_parent_not_sampled"] = coerced88;}}}if(!(((data132 === "always_on") || (data132 === "always_off")) || (data132 === "adaptive"))){const err184 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.partial_granularity.properties.remote_parent_not_sampled.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err184];}else {vErrors.push(err184);}errors++;}var _valid7 = _errs366 === errors;if(_valid7){valid84 = true;passing7 = 0;}const _errs368 = errors;if(data132 && typeof data132 == "object" && !Array.isArray(data132)){if(data132.trace_id_ratio_based === undefined){const err185 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err185];}else {vErrors.push(err185);}errors++;}if(data132.trace_id_ratio_based !== undefined){let data133 = data132.trace_id_ratio_based;if(data133 && typeof data133 == "object" && !Array.isArray(data133)){if(data133.ratio === undefined){const err186 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err186];}else {vErrors.push(err186);}errors++;}if(data133.ratio !== undefined){let data134 = data133.ratio;if(!(typeof data134 == "number")){let dataType89 = typeof data134;let coerced89 = undefined;if(!(coerced89 !== undefined)){if(dataType89 == "boolean" || data134 === null
                  || (dataType89 == "string" && data134 && data134 == +data134)){coerced89 = +data134;}else {const err187 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err187];}else {vErrors.push(err187);}errors++;}}if(coerced89 !== undefined){data134 = coerced89;if(data133 !== undefined){data133["ratio"] = coerced89;}}}}}else {const err188 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err188];}else {vErrors.push(err188);}errors++;}}}else {const err189 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err189];}else {vErrors.push(err189);}errors++;}var _valid7 = _errs368 === errors;if(_valid7 && valid84){valid84 = false;passing7 = [passing7, 1];}else {if(_valid7){valid84 = true;passing7 = 1;var props5 = true;}const _errs376 = errors;if(data132 && typeof data132 == "object" && !Array.isArray(data132)){if(data132.adaptive === undefined){const err190 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err190];}else {vErrors.push(err190);}errors++;}if(data132.adaptive !== undefined){let data135 = data132.adaptive;if(data135 && typeof data135 == "object" && !Array.isArray(data135)){if(data135.sampling_target !== undefined){let data136 = data135.sampling_target;if(!((typeof data136 == "number") && (!(data136 % 1) && !isNaN(data136)))){let dataType90 = typeof data136;let coerced90 = undefined;if(!(coerced90 !== undefined)){if(dataType90 === "boolean" || data136 === null
                  || (dataType90 === "string" && data136 && data136 == +data136 && !(data136 % 1))){coerced90 = +data136;}else {const err191 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err191];}else {vErrors.push(err191);}errors++;}}if(coerced90 !== undefined){data136 = coerced90;if(data135 !== undefined){data135["sampling_target"] = coerced90;}}}if(typeof data136 == "number"){if(data136 > 120 || isNaN(data136)){const err192 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err192];}else {vErrors.push(err192);}errors++;}if(data136 < 1 || isNaN(data136)){const err193 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err193];}else {vErrors.push(err193);}errors++;}}}}else {const err194 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err194];}else {vErrors.push(err194);}errors++;}}}else {const err195 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err195];}else {vErrors.push(err195);}errors++;}var _valid7 = _errs376 === errors;if(_valid7 && valid84){valid84 = false;passing7 = [passing7, 2];}else {if(_valid7){valid84 = true;passing7 = 2;if(props5 !== true){props5 = true;}}}}if(!valid84){const err196 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf",keyword:"oneOf",params:{passingSchemas: passing7},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err196];}else {vErrors.push(err196);}errors++;}else {errors = _errs365;if(vErrors !== null){if(_errs365){vErrors.length = _errs365;}else {vErrors = null;}}}}}else {const err197 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err197];}else {vErrors.push(err197);}errors++;}}}else {const err198 = {instancePath:instancePath+"/distributed_tracing/sampler",schemaPath:"distributed-tracing.js/properties/sampler/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err198];}else {vErrors.push(err198);}errors++;}}}else {const err199 = {instancePath:instancePath+"/distributed_tracing",schemaPath:"distributed-tracing.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err199];}else {vErrors.push(err199);}errors++;}}if(data.error_collector !== undefined){let data137 = data.error_collector;if(data137 && typeof data137 == "object" && !Array.isArray(data137)){if(data137.attributes !== undefined){let data138 = data137.attributes;if(data138 && typeof data138 == "object" && !Array.isArray(data138)){if(data138.enabled !== undefined){let data139 = data138.enabled;if(typeof data139 !== "boolean"){let coerced91 = undefined;if(!(coerced91 !== undefined)){if(data139 === "false" || data139 === 0 || data139 === null){coerced91 = false;}else if(data139 === "true" || data139 === 1){coerced91 = true;}else {const err200 = {instancePath:instancePath+"/error_collector/attributes/enabled",schemaPath:"error-collector.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err200];}else {vErrors.push(err200);}errors++;}}if(coerced91 !== undefined){data139 = coerced91;if(data138 !== undefined){data138["enabled"] = coerced91;}}}}if(data138.exclude !== undefined){let data140 = data138.exclude;if(Array.isArray(data140)){const len8 = data140.length;for(let i8=0; i8<len8; i8++){let data141 = data140[i8];if(typeof data141 !== "string"){let dataType92 = typeof data141;let coerced92 = undefined;if(!(coerced92 !== undefined)){if(dataType92 == "number" || dataType92 == "boolean"){coerced92 = "" + data141;}else if(data141 === null){coerced92 = "";}else {const err201 = {instancePath:instancePath+"/error_collector/attributes/exclude/" + i8,schemaPath:"error-collector.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err201];}else {vErrors.push(err201);}errors++;}}if(coerced92 !== undefined){data141 = coerced92;if(data140 !== undefined){data140[i8] = coerced92;}}}}}else {const err202 = {instancePath:instancePath+"/error_collector/attributes/exclude",schemaPath:"error-collector.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err202];}else {vErrors.push(err202);}errors++;}}if(data138.include !== undefined){let data142 = data138.include;if(Array.isArray(data142)){const len9 = data142.length;for(let i9=0; i9<len9; i9++){let data143 = data142[i9];if(typeof data143 !== "string"){let dataType93 = typeof data143;let coerced93 = undefined;if(!(coerced93 !== undefined)){if(dataType93 == "number" || dataType93 == "boolean"){coerced93 = "" + data143;}else if(data143 === null){coerced93 = "";}else {const err203 = {instancePath:instancePath+"/error_collector/attributes/include/" + i9,schemaPath:"error-collector.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err203];}else {vErrors.push(err203);}errors++;}}if(coerced93 !== undefined){data143 = coerced93;if(data142 !== undefined){data142[i9] = coerced93;}}}}}else {const err204 = {instancePath:instancePath+"/error_collector/attributes/include",schemaPath:"error-collector.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err204];}else {vErrors.push(err204);}errors++;}}}else {const err205 = {instancePath:instancePath+"/error_collector/attributes",schemaPath:"error-collector.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err205];}else {vErrors.push(err205);}errors++;}}if(data137.enabled !== undefined){let data144 = data137.enabled;if(typeof data144 !== "boolean"){let coerced94 = undefined;if(!(coerced94 !== undefined)){if(data144 === "false" || data144 === 0 || data144 === null){coerced94 = false;}else if(data144 === "true" || data144 === 1){coerced94 = true;}else {const err206 = {instancePath:instancePath+"/error_collector/enabled",schemaPath:"error-collector.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err206];}else {vErrors.push(err206);}errors++;}}if(coerced94 !== undefined){data144 = coerced94;if(data137 !== undefined){data137["enabled"] = coerced94;}}}}if(data137.ignore_status_codes !== undefined){let data145 = data137.ignore_status_codes;if(Array.isArray(data145)){const len10 = data145.length;for(let i10=0; i10<len10; i10++){let data146 = data145[i10];if(typeof data146 !== "string"){let dataType95 = typeof data146;let coerced95 = undefined;if(!(coerced95 !== undefined)){if(dataType95 == "number" || dataType95 == "boolean"){coerced95 = "" + data146;}else if(data146 === null){coerced95 = "";}else {const err207 = {instancePath:instancePath+"/error_collector/ignore_status_codes/" + i10,schemaPath:"error-collector.js/properties/ignore_status_codes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err207];}else {vErrors.push(err207);}errors++;}}if(coerced95 !== undefined){data146 = coerced95;if(data145 !== undefined){data145[i10] = coerced95;}}}}}else {const err208 = {instancePath:instancePath+"/error_collector/ignore_status_codes",schemaPath:"error-collector.js/properties/ignore_status_codes/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err208];}else {vErrors.push(err208);}errors++;}}if(data137.capture_events !== undefined){let data147 = data137.capture_events;if(typeof data147 !== "boolean"){let coerced96 = undefined;if(!(coerced96 !== undefined)){if(data147 === "false" || data147 === 0 || data147 === null){coerced96 = false;}else if(data147 === "true" || data147 === 1){coerced96 = true;}else {const err209 = {instancePath:instancePath+"/error_collector/capture_events",schemaPath:"error-collector.js/properties/capture_events/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err209];}else {vErrors.push(err209);}errors++;}}if(coerced96 !== undefined){data147 = coerced96;if(data137 !== undefined){data137["capture_events"] = coerced96;}}}}if(data137.max_event_samples_stored !== undefined){let data148 = data137.max_event_samples_stored;if(!((typeof data148 == "number") && (!(data148 % 1) && !isNaN(data148)))){let dataType97 = typeof data148;let coerced97 = undefined;if(!(coerced97 !== undefined)){if(dataType97 === "boolean" || data148 === null
                  || (dataType97 === "string" && data148 && data148 == +data148 && !(data148 % 1))){coerced97 = +data148;}else {const err210 = {instancePath:instancePath+"/error_collector/max_event_samples_stored",schemaPath:"error-collector.js/properties/max_event_samples_stored/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err210];}else {vErrors.push(err210);}errors++;}}if(coerced97 !== undefined){data148 = coerced97;if(data137 !== undefined){data137["max_event_samples_stored"] = coerced97;}}}}if(data137.expected_classes !== undefined){let data149 = data137.expected_classes;if(Array.isArray(data149)){const len11 = data149.length;for(let i11=0; i11<len11; i11++){let data150 = data149[i11];if(typeof data150 !== "string"){let dataType98 = typeof data150;let coerced98 = undefined;if(!(coerced98 !== undefined)){if(dataType98 == "number" || dataType98 == "boolean"){coerced98 = "" + data150;}else if(data150 === null){coerced98 = "";}else {const err211 = {instancePath:instancePath+"/error_collector/expected_classes/" + i11,schemaPath:"error-collector.js/properties/expected_classes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err211];}else {vErrors.push(err211);}errors++;}}if(coerced98 !== undefined){data150 = coerced98;if(data149 !== undefined){data149[i11] = coerced98;}}}}}else {const err212 = {instancePath:instancePath+"/error_collector/expected_classes",schemaPath:"error-collector.js/properties/expected_classes/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err212];}else {vErrors.push(err212);}errors++;}}if(data137.expected_messages !== undefined){let data151 = data137.expected_messages;if(data151 && typeof data151 == "object" && !Array.isArray(data151)){}else {const err213 = {instancePath:instancePath+"/error_collector/expected_messages",schemaPath:"error-collector.js/properties/expected_messages/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err213];}else {vErrors.push(err213);}errors++;}}if(data137.expected_status_codes !== undefined){let data152 = data137.expected_status_codes;if(Array.isArray(data152)){const len12 = data152.length;for(let i12=0; i12<len12; i12++){let data153 = data152[i12];if(typeof data153 !== "string"){let dataType99 = typeof data153;let coerced99 = undefined;if(!(coerced99 !== undefined)){if(dataType99 == "number" || dataType99 == "boolean"){coerced99 = "" + data153;}else if(data153 === null){coerced99 = "";}else {const err214 = {instancePath:instancePath+"/error_collector/expected_status_codes/" + i12,schemaPath:"error-collector.js/properties/expected_status_codes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err214];}else {vErrors.push(err214);}errors++;}}if(coerced99 !== undefined){data153 = coerced99;if(data152 !== undefined){data152[i12] = coerced99;}}}}}else {const err215 = {instancePath:instancePath+"/error_collector/expected_status_codes",schemaPath:"error-collector.js/properties/expected_status_codes/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err215];}else {vErrors.push(err215);}errors++;}}if(data137.ignore_classes !== undefined){let data154 = data137.ignore_classes;if(Array.isArray(data154)){const len13 = data154.length;for(let i13=0; i13<len13; i13++){let data155 = data154[i13];if(typeof data155 !== "string"){let dataType100 = typeof data155;let coerced100 = undefined;if(!(coerced100 !== undefined)){if(dataType100 == "number" || dataType100 == "boolean"){coerced100 = "" + data155;}else if(data155 === null){coerced100 = "";}else {const err216 = {instancePath:instancePath+"/error_collector/ignore_classes/" + i13,schemaPath:"error-collector.js/properties/ignore_classes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err216];}else {vErrors.push(err216);}errors++;}}if(coerced100 !== undefined){data155 = coerced100;if(data154 !== undefined){data154[i13] = coerced100;}}}}}else {const err217 = {instancePath:instancePath+"/error_collector/ignore_classes",schemaPath:"error-collector.js/properties/ignore_classes/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err217];}else {vErrors.push(err217);}errors++;}}if(data137.ignore_messages !== undefined){let data156 = data137.ignore_messages;if(data156 && typeof data156 == "object" && !Array.isArray(data156)){}else {const err218 = {instancePath:instancePath+"/error_collector/ignore_messages",schemaPath:"error-collector.js/properties/ignore_messages/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err218];}else {vErrors.push(err218);}errors++;}}}else {const err219 = {instancePath:instancePath+"/error_collector",schemaPath:"error-collector.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err219];}else {vErrors.push(err219);}errors++;}}if(data.grpc !== undefined){let data157 = data.grpc;if(data157 && typeof data157 == "object" && !Array.isArray(data157)){if(data157.record_errors !== undefined){let data158 = data157.record_errors;if(typeof data158 !== "boolean"){let coerced101 = undefined;if(!(coerced101 !== undefined)){if(data158 === "false" || data158 === 0 || data158 === null){coerced101 = false;}else if(data158 === "true" || data158 === 1){coerced101 = true;}else {const err220 = {instancePath:instancePath+"/grpc/record_errors",schemaPath:"grpc.js/properties/record_errors/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err220];}else {vErrors.push(err220);}errors++;}}if(coerced101 !== undefined){data158 = coerced101;if(data157 !== undefined){data157["record_errors"] = coerced101;}}}}if(data157.ignore_status_codes !== undefined){let data159 = data157.ignore_status_codes;if(Array.isArray(data159)){const len14 = data159.length;for(let i14=0; i14<len14; i14++){let data160 = data159[i14];if(typeof data160 !== "string"){let dataType102 = typeof data160;let coerced102 = undefined;if(!(coerced102 !== undefined)){if(dataType102 == "number" || dataType102 == "boolean"){coerced102 = "" + data160;}else if(data160 === null){coerced102 = "";}else {const err221 = {instancePath:instancePath+"/grpc/ignore_status_codes/" + i14,schemaPath:"grpc.js/properties/ignore_status_codes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err221];}else {vErrors.push(err221);}errors++;}}if(coerced102 !== undefined){data160 = coerced102;if(data159 !== undefined){data159[i14] = coerced102;}}}}}else {const err222 = {instancePath:instancePath+"/grpc/ignore_status_codes",schemaPath:"grpc.js/properties/ignore_status_codes/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err222];}else {vErrors.push(err222);}errors++;}}}else {const err223 = {instancePath:instancePath+"/grpc",schemaPath:"grpc.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err223];}else {vErrors.push(err223);}errors++;}}if(data.heroku !== undefined){let data161 = data.heroku;if(data161 && typeof data161 == "object" && !Array.isArray(data161)){if(data161.use_dyno_names !== undefined){let data162 = data161.use_dyno_names;if(typeof data162 !== "boolean"){let coerced103 = undefined;if(!(coerced103 !== undefined)){if(data162 === "false" || data162 === 0 || data162 === null){coerced103 = false;}else if(data162 === "true" || data162 === 1){coerced103 = true;}else {const err224 = {instancePath:instancePath+"/heroku/use_dyno_names",schemaPath:"heroku.js/properties/use_dyno_names/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err224];}else {vErrors.push(err224);}errors++;}}if(coerced103 !== undefined){data162 = coerced103;if(data161 !== undefined){data161["use_dyno_names"] = coerced103;}}}}}else {const err225 = {instancePath:instancePath+"/heroku",schemaPath:"heroku.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err225];}else {vErrors.push(err225);}errors++;}}if(data.infinite_tracing !== undefined){let data163 = data.infinite_tracing;if(data163 && typeof data163 == "object" && !Array.isArray(data163)){if(data163.trace_observer !== undefined){let data164 = data163.trace_observer;if(data164 && typeof data164 == "object" && !Array.isArray(data164)){if(data164.host !== undefined){let data165 = data164.host;if(typeof data165 !== "string"){let dataType104 = typeof data165;let coerced104 = undefined;if(!(coerced104 !== undefined)){if(dataType104 == "number" || dataType104 == "boolean"){coerced104 = "" + data165;}else if(data165 === null){coerced104 = "";}else {const err226 = {instancePath:instancePath+"/infinite_tracing/trace_observer/host",schemaPath:"infinite-tracing.js/properties/trace_observer/properties/host/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err226];}else {vErrors.push(err226);}errors++;}}if(coerced104 !== undefined){data165 = coerced104;if(data164 !== undefined){data164["host"] = coerced104;}}}}if(data164.port !== undefined){let data166 = data164.port;if(!((typeof data166 == "number") && (!(data166 % 1) && !isNaN(data166)))){let dataType105 = typeof data166;let coerced105 = undefined;if(!(coerced105 !== undefined)){if(dataType105 === "boolean" || data166 === null
                  || (dataType105 === "string" && data166 && data166 == +data166 && !(data166 % 1))){coerced105 = +data166;}else {const err227 = {instancePath:instancePath+"/infinite_tracing/trace_observer/port",schemaPath:"infinite-tracing.js/properties/trace_observer/properties/port/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err227];}else {vErrors.push(err227);}errors++;}}if(coerced105 !== undefined){data166 = coerced105;if(data164 !== undefined){data164["port"] = coerced105;}}}}if(data164.insecure !== undefined){let data167 = data164.insecure;if(typeof data167 !== "boolean"){let coerced106 = undefined;if(!(coerced106 !== undefined)){if(data167 === "false" || data167 === 0 || data167 === null){coerced106 = false;}else if(data167 === "true" || data167 === 1){coerced106 = true;}else {const err228 = {instancePath:instancePath+"/infinite_tracing/trace_observer/insecure",schemaPath:"infinite-tracing.js/properties/trace_observer/properties/insecure/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err228];}else {vErrors.push(err228);}errors++;}}if(coerced106 !== undefined){data167 = coerced106;if(data164 !== undefined){data164["insecure"] = coerced106;}}}}}else {const err229 = {instancePath:instancePath+"/infinite_tracing/trace_observer",schemaPath:"infinite-tracing.js/properties/trace_observer/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err229];}else {vErrors.push(err229);}errors++;}}if(data163.span_events !== undefined){let data168 = data163.span_events;if(data168 && typeof data168 == "object" && !Array.isArray(data168)){if(data168.queue_size !== undefined){let data169 = data168.queue_size;if(!((typeof data169 == "number") && (!(data169 % 1) && !isNaN(data169)))){let dataType107 = typeof data169;let coerced107 = undefined;if(!(coerced107 !== undefined)){if(dataType107 === "boolean" || data169 === null
                  || (dataType107 === "string" && data169 && data169 == +data169 && !(data169 % 1))){coerced107 = +data169;}else {const err230 = {instancePath:instancePath+"/infinite_tracing/span_events/queue_size",schemaPath:"infinite-tracing.js/properties/span_events/properties/queue_size/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err230];}else {vErrors.push(err230);}errors++;}}if(coerced107 !== undefined){data169 = coerced107;if(data168 !== undefined){data168["queue_size"] = coerced107;}}}}if(data168.batch_size !== undefined){let data170 = data168.batch_size;if(!((typeof data170 == "number") && (!(data170 % 1) && !isNaN(data170)))){let dataType108 = typeof data170;let coerced108 = undefined;if(!(coerced108 !== undefined)){if(dataType108 === "boolean" || data170 === null
                  || (dataType108 === "string" && data170 && data170 == +data170 && !(data170 % 1))){coerced108 = +data170;}else {const err231 = {instancePath:instancePath+"/infinite_tracing/span_events/batch_size",schemaPath:"infinite-tracing.js/properties/span_events/properties/batch_size/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err231];}else {vErrors.push(err231);}errors++;}}if(coerced108 !== undefined){data170 = coerced108;if(data168 !== undefined){data168["batch_size"] = coerced108;}}}}}else {const err232 = {instancePath:instancePath+"/infinite_tracing/span_events",schemaPath:"infinite-tracing.js/properties/span_events/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err232];}else {vErrors.push(err232);}errors++;}}if(data163.batching !== undefined){let data171 = data163.batching;if(typeof data171 !== "boolean"){let coerced109 = undefined;if(!(coerced109 !== undefined)){if(data171 === "false" || data171 === 0 || data171 === null){coerced109 = false;}else if(data171 === "true" || data171 === 1){coerced109 = true;}else {const err233 = {instancePath:instancePath+"/infinite_tracing/batching",schemaPath:"infinite-tracing.js/properties/batching/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err233];}else {vErrors.push(err233);}errors++;}}if(coerced109 !== undefined){data171 = coerced109;if(data163 !== undefined){data163["batching"] = coerced109;}}}}if(data163.compression !== undefined){let data172 = data163.compression;if(typeof data172 !== "boolean"){let coerced110 = undefined;if(!(coerced110 !== undefined)){if(data172 === "false" || data172 === 0 || data172 === null){coerced110 = false;}else if(data172 === "true" || data172 === 1){coerced110 = true;}else {const err234 = {instancePath:instancePath+"/infinite_tracing/compression",schemaPath:"infinite-tracing.js/properties/compression/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err234];}else {vErrors.push(err234);}errors++;}}if(coerced110 !== undefined){data172 = coerced110;if(data163 !== undefined){data163["compression"] = coerced110;}}}}}else {const err235 = {instancePath:instancePath+"/infinite_tracing",schemaPath:"infinite-tracing.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err235];}else {vErrors.push(err235);}errors++;}}if(data.instrumentation !== undefined){let data173 = data.instrumentation;if(data173 && typeof data173 == "object" && !Array.isArray(data173)){for(const key0 in data173){if(!(func1.call(schema49.properties, key0))){let data174 = data173[key0];if(data174 && typeof data174 == "object" && !Array.isArray(data174)){if(data174.enabled !== undefined){let data175 = data174.enabled;if(typeof data175 !== "boolean"){let coerced111 = undefined;if(!(coerced111 !== undefined)){if(data175 === "false" || data175 === 0 || data175 === null){coerced111 = false;}else if(data175 === "true" || data175 === 1){coerced111 = true;}else {const err236 = {instancePath:instancePath+"/instrumentation/" + key0.replace(/~/g, "~0").replace(/\//g, "~1")+"/enabled",schemaPath:"instrumentation.js/additionalProperties/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err236];}else {vErrors.push(err236);}errors++;}}if(coerced111 !== undefined){data175 = coerced111;if(data174 !== undefined){data174["enabled"] = coerced111;}}}}}else {const err237 = {instancePath:instancePath+"/instrumentation/" + key0.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"instrumentation.js/additionalProperties/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err237];}else {vErrors.push(err237);}errors++;}}}if(data173["@anthropic-ai/sdk"] !== undefined){let data176 = data173["@anthropic-ai/sdk"];if(data176 && typeof data176 == "object" && !Array.isArray(data176)){if(data176.enabled !== undefined){let data177 = data176.enabled;if(typeof data177 !== "boolean"){let coerced112 = undefined;if(!(coerced112 !== undefined)){if(data177 === "false" || data177 === 0 || data177 === null){coerced112 = false;}else if(data177 === "true" || data177 === 1){coerced112 = true;}else {const err238 = {instancePath:instancePath+"/instrumentation/@anthropic-ai~1sdk/enabled",schemaPath:"instrumentation.js/properties/%40anthropic-ai~1sdk/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err238];}else {vErrors.push(err238);}errors++;}}if(coerced112 !== undefined){data177 = coerced112;if(data176 !== undefined){data176["enabled"] = coerced112;}}}}}else {const err239 = {instancePath:instancePath+"/instrumentation/@anthropic-ai~1sdk",schemaPath:"instrumentation.js/properties/%40anthropic-ai~1sdk/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err239];}else {vErrors.push(err239);}errors++;}}if(data173["@apollo/server"] !== undefined){let data178 = data173["@apollo/server"];if(data178 && typeof data178 == "object" && !Array.isArray(data178)){if(data178.enabled !== undefined){let data179 = data178.enabled;if(typeof data179 !== "boolean"){let coerced113 = undefined;if(!(coerced113 !== undefined)){if(data179 === "false" || data179 === 0 || data179 === null){coerced113 = false;}else if(data179 === "true" || data179 === 1){coerced113 = true;}else {const err240 = {instancePath:instancePath+"/instrumentation/@apollo~1server/enabled",schemaPath:"instrumentation.js/properties/%40apollo~1server/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err240];}else {vErrors.push(err240);}errors++;}}if(coerced113 !== undefined){data179 = coerced113;if(data178 !== undefined){data178["enabled"] = coerced113;}}}}}else {const err241 = {instancePath:instancePath+"/instrumentation/@apollo~1server",schemaPath:"instrumentation.js/properties/%40apollo~1server/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err241];}else {vErrors.push(err241);}errors++;}}if(data173["@aws-sdk/smithy-client"] !== undefined){let data180 = data173["@aws-sdk/smithy-client"];if(data180 && typeof data180 == "object" && !Array.isArray(data180)){if(data180.enabled !== undefined){let data181 = data180.enabled;if(typeof data181 !== "boolean"){let coerced114 = undefined;if(!(coerced114 !== undefined)){if(data181 === "false" || data181 === 0 || data181 === null){coerced114 = false;}else if(data181 === "true" || data181 === 1){coerced114 = true;}else {const err242 = {instancePath:instancePath+"/instrumentation/@aws-sdk~1smithy-client/enabled",schemaPath:"instrumentation.js/properties/%40aws-sdk~1smithy-client/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err242];}else {vErrors.push(err242);}errors++;}}if(coerced114 !== undefined){data181 = coerced114;if(data180 !== undefined){data180["enabled"] = coerced114;}}}}}else {const err243 = {instancePath:instancePath+"/instrumentation/@aws-sdk~1smithy-client",schemaPath:"instrumentation.js/properties/%40aws-sdk~1smithy-client/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err243];}else {vErrors.push(err243);}errors++;}}if(data173["@azure/functions"] !== undefined){let data182 = data173["@azure/functions"];if(data182 && typeof data182 == "object" && !Array.isArray(data182)){if(data182.enabled !== undefined){let data183 = data182.enabled;if(typeof data183 !== "boolean"){let coerced115 = undefined;if(!(coerced115 !== undefined)){if(data183 === "false" || data183 === 0 || data183 === null){coerced115 = false;}else if(data183 === "true" || data183 === 1){coerced115 = true;}else {const err244 = {instancePath:instancePath+"/instrumentation/@azure~1functions/enabled",schemaPath:"instrumentation.js/properties/%40azure~1functions/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err244];}else {vErrors.push(err244);}errors++;}}if(coerced115 !== undefined){data183 = coerced115;if(data182 !== undefined){data182["enabled"] = coerced115;}}}}}else {const err245 = {instancePath:instancePath+"/instrumentation/@azure~1functions",schemaPath:"instrumentation.js/properties/%40azure~1functions/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err245];}else {vErrors.push(err245);}errors++;}}if(data173["@elastic/elasticsearch"] !== undefined){let data184 = data173["@elastic/elasticsearch"];if(data184 && typeof data184 == "object" && !Array.isArray(data184)){if(data184.enabled !== undefined){let data185 = data184.enabled;if(typeof data185 !== "boolean"){let coerced116 = undefined;if(!(coerced116 !== undefined)){if(data185 === "false" || data185 === 0 || data185 === null){coerced116 = false;}else if(data185 === "true" || data185 === 1){coerced116 = true;}else {const err246 = {instancePath:instancePath+"/instrumentation/@elastic~1elasticsearch/enabled",schemaPath:"instrumentation.js/properties/%40elastic~1elasticsearch/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err246];}else {vErrors.push(err246);}errors++;}}if(coerced116 !== undefined){data185 = coerced116;if(data184 !== undefined){data184["enabled"] = coerced116;}}}}}else {const err247 = {instancePath:instancePath+"/instrumentation/@elastic~1elasticsearch",schemaPath:"instrumentation.js/properties/%40elastic~1elasticsearch/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err247];}else {vErrors.push(err247);}errors++;}}if(data173["@elastic/transport"] !== undefined){let data186 = data173["@elastic/transport"];if(data186 && typeof data186 == "object" && !Array.isArray(data186)){if(data186.enabled !== undefined){let data187 = data186.enabled;if(typeof data187 !== "boolean"){let coerced117 = undefined;if(!(coerced117 !== undefined)){if(data187 === "false" || data187 === 0 || data187 === null){coerced117 = false;}else if(data187 === "true" || data187 === 1){coerced117 = true;}else {const err248 = {instancePath:instancePath+"/instrumentation/@elastic~1transport/enabled",schemaPath:"instrumentation.js/properties/%40elastic~1transport/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err248];}else {vErrors.push(err248);}errors++;}}if(coerced117 !== undefined){data187 = coerced117;if(data186 !== undefined){data186["enabled"] = coerced117;}}}}}else {const err249 = {instancePath:instancePath+"/instrumentation/@elastic~1transport",schemaPath:"instrumentation.js/properties/%40elastic~1transport/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err249];}else {vErrors.push(err249);}errors++;}}if(data173["@google/adk"] !== undefined){let data188 = data173["@google/adk"];if(data188 && typeof data188 == "object" && !Array.isArray(data188)){if(data188.enabled !== undefined){let data189 = data188.enabled;if(typeof data189 !== "boolean"){let coerced118 = undefined;if(!(coerced118 !== undefined)){if(data189 === "false" || data189 === 0 || data189 === null){coerced118 = false;}else if(data189 === "true" || data189 === 1){coerced118 = true;}else {const err250 = {instancePath:instancePath+"/instrumentation/@google~1adk/enabled",schemaPath:"instrumentation.js/properties/%40google~1adk/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err250];}else {vErrors.push(err250);}errors++;}}if(coerced118 !== undefined){data189 = coerced118;if(data188 !== undefined){data188["enabled"] = coerced118;}}}}}else {const err251 = {instancePath:instancePath+"/instrumentation/@google~1adk",schemaPath:"instrumentation.js/properties/%40google~1adk/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err251];}else {vErrors.push(err251);}errors++;}}if(data173["@google/genai"] !== undefined){let data190 = data173["@google/genai"];if(data190 && typeof data190 == "object" && !Array.isArray(data190)){if(data190.enabled !== undefined){let data191 = data190.enabled;if(typeof data191 !== "boolean"){let coerced119 = undefined;if(!(coerced119 !== undefined)){if(data191 === "false" || data191 === 0 || data191 === null){coerced119 = false;}else if(data191 === "true" || data191 === 1){coerced119 = true;}else {const err252 = {instancePath:instancePath+"/instrumentation/@google~1genai/enabled",schemaPath:"instrumentation.js/properties/%40google~1genai/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err252];}else {vErrors.push(err252);}errors++;}}if(coerced119 !== undefined){data191 = coerced119;if(data190 !== undefined){data190["enabled"] = coerced119;}}}}}else {const err253 = {instancePath:instancePath+"/instrumentation/@google~1genai",schemaPath:"instrumentation.js/properties/%40google~1genai/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err253];}else {vErrors.push(err253);}errors++;}}if(data173["@grpc/grpc-js"] !== undefined){let data192 = data173["@grpc/grpc-js"];if(data192 && typeof data192 == "object" && !Array.isArray(data192)){if(data192.enabled !== undefined){let data193 = data192.enabled;if(typeof data193 !== "boolean"){let coerced120 = undefined;if(!(coerced120 !== undefined)){if(data193 === "false" || data193 === 0 || data193 === null){coerced120 = false;}else if(data193 === "true" || data193 === 1){coerced120 = true;}else {const err254 = {instancePath:instancePath+"/instrumentation/@grpc~1grpc-js/enabled",schemaPath:"instrumentation.js/properties/%40grpc~1grpc-js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err254];}else {vErrors.push(err254);}errors++;}}if(coerced120 !== undefined){data193 = coerced120;if(data192 !== undefined){data192["enabled"] = coerced120;}}}}}else {const err255 = {instancePath:instancePath+"/instrumentation/@grpc~1grpc-js",schemaPath:"instrumentation.js/properties/%40grpc~1grpc-js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err255];}else {vErrors.push(err255);}errors++;}}if(data173["@hapi/hapi"] !== undefined){let data194 = data173["@hapi/hapi"];if(data194 && typeof data194 == "object" && !Array.isArray(data194)){if(data194.enabled !== undefined){let data195 = data194.enabled;if(typeof data195 !== "boolean"){let coerced121 = undefined;if(!(coerced121 !== undefined)){if(data195 === "false" || data195 === 0 || data195 === null){coerced121 = false;}else if(data195 === "true" || data195 === 1){coerced121 = true;}else {const err256 = {instancePath:instancePath+"/instrumentation/@hapi~1hapi/enabled",schemaPath:"instrumentation.js/properties/%40hapi~1hapi/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err256];}else {vErrors.push(err256);}errors++;}}if(coerced121 !== undefined){data195 = coerced121;if(data194 !== undefined){data194["enabled"] = coerced121;}}}}}else {const err257 = {instancePath:instancePath+"/instrumentation/@hapi~1hapi",schemaPath:"instrumentation.js/properties/%40hapi~1hapi/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err257];}else {vErrors.push(err257);}errors++;}}if(data173["@hapi/vision"] !== undefined){let data196 = data173["@hapi/vision"];if(data196 && typeof data196 == "object" && !Array.isArray(data196)){if(data196.enabled !== undefined){let data197 = data196.enabled;if(typeof data197 !== "boolean"){let coerced122 = undefined;if(!(coerced122 !== undefined)){if(data197 === "false" || data197 === 0 || data197 === null){coerced122 = false;}else if(data197 === "true" || data197 === 1){coerced122 = true;}else {const err258 = {instancePath:instancePath+"/instrumentation/@hapi~1vision/enabled",schemaPath:"instrumentation.js/properties/%40hapi~1vision/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err258];}else {vErrors.push(err258);}errors++;}}if(coerced122 !== undefined){data197 = coerced122;if(data196 !== undefined){data196["enabled"] = coerced122;}}}}}else {const err259 = {instancePath:instancePath+"/instrumentation/@hapi~1vision",schemaPath:"instrumentation.js/properties/%40hapi~1vision/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err259];}else {vErrors.push(err259);}errors++;}}if(data173["@langchain/core"] !== undefined){let data198 = data173["@langchain/core"];if(data198 && typeof data198 == "object" && !Array.isArray(data198)){if(data198.enabled !== undefined){let data199 = data198.enabled;if(typeof data199 !== "boolean"){let coerced123 = undefined;if(!(coerced123 !== undefined)){if(data199 === "false" || data199 === 0 || data199 === null){coerced123 = false;}else if(data199 === "true" || data199 === 1){coerced123 = true;}else {const err260 = {instancePath:instancePath+"/instrumentation/@langchain~1core/enabled",schemaPath:"instrumentation.js/properties/%40langchain~1core/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err260];}else {vErrors.push(err260);}errors++;}}if(coerced123 !== undefined){data199 = coerced123;if(data198 !== undefined){data198["enabled"] = coerced123;}}}}}else {const err261 = {instancePath:instancePath+"/instrumentation/@langchain~1core",schemaPath:"instrumentation.js/properties/%40langchain~1core/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err261];}else {vErrors.push(err261);}errors++;}}if(data173["@langchain/langgraph"] !== undefined){let data200 = data173["@langchain/langgraph"];if(data200 && typeof data200 == "object" && !Array.isArray(data200)){if(data200.enabled !== undefined){let data201 = data200.enabled;if(typeof data201 !== "boolean"){let coerced124 = undefined;if(!(coerced124 !== undefined)){if(data201 === "false" || data201 === 0 || data201 === null){coerced124 = false;}else if(data201 === "true" || data201 === 1){coerced124 = true;}else {const err262 = {instancePath:instancePath+"/instrumentation/@langchain~1langgraph/enabled",schemaPath:"instrumentation.js/properties/%40langchain~1langgraph/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err262];}else {vErrors.push(err262);}errors++;}}if(coerced124 !== undefined){data201 = coerced124;if(data200 !== undefined){data200["enabled"] = coerced124;}}}}}else {const err263 = {instancePath:instancePath+"/instrumentation/@langchain~1langgraph",schemaPath:"instrumentation.js/properties/%40langchain~1langgraph/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err263];}else {vErrors.push(err263);}errors++;}}if(data173["@modelcontextprotocol/sdk"] !== undefined){let data202 = data173["@modelcontextprotocol/sdk"];if(data202 && typeof data202 == "object" && !Array.isArray(data202)){if(data202.enabled !== undefined){let data203 = data202.enabled;if(typeof data203 !== "boolean"){let coerced125 = undefined;if(!(coerced125 !== undefined)){if(data203 === "false" || data203 === 0 || data203 === null){coerced125 = false;}else if(data203 === "true" || data203 === 1){coerced125 = true;}else {const err264 = {instancePath:instancePath+"/instrumentation/@modelcontextprotocol~1sdk/enabled",schemaPath:"instrumentation.js/properties/%40modelcontextprotocol~1sdk/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err264];}else {vErrors.push(err264);}errors++;}}if(coerced125 !== undefined){data203 = coerced125;if(data202 !== undefined){data202["enabled"] = coerced125;}}}}}else {const err265 = {instancePath:instancePath+"/instrumentation/@modelcontextprotocol~1sdk",schemaPath:"instrumentation.js/properties/%40modelcontextprotocol~1sdk/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err265];}else {vErrors.push(err265);}errors++;}}if(data173["@modelcontextprotocol/sdk/client/index.js"] !== undefined){let data204 = data173["@modelcontextprotocol/sdk/client/index.js"];if(data204 && typeof data204 == "object" && !Array.isArray(data204)){if(data204.enabled !== undefined){let data205 = data204.enabled;if(typeof data205 !== "boolean"){let coerced126 = undefined;if(!(coerced126 !== undefined)){if(data205 === "false" || data205 === 0 || data205 === null){coerced126 = false;}else if(data205 === "true" || data205 === 1){coerced126 = true;}else {const err266 = {instancePath:instancePath+"/instrumentation/@modelcontextprotocol~1sdk~1client~1index.js/enabled",schemaPath:"instrumentation.js/properties/%40modelcontextprotocol~1sdk~1client~1index.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err266];}else {vErrors.push(err266);}errors++;}}if(coerced126 !== undefined){data205 = coerced126;if(data204 !== undefined){data204["enabled"] = coerced126;}}}}}else {const err267 = {instancePath:instancePath+"/instrumentation/@modelcontextprotocol~1sdk~1client~1index.js",schemaPath:"instrumentation.js/properties/%40modelcontextprotocol~1sdk~1client~1index.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err267];}else {vErrors.push(err267);}errors++;}}if(data173["@nestjs/core"] !== undefined){let data206 = data173["@nestjs/core"];if(data206 && typeof data206 == "object" && !Array.isArray(data206)){if(data206.enabled !== undefined){let data207 = data206.enabled;if(typeof data207 !== "boolean"){let coerced127 = undefined;if(!(coerced127 !== undefined)){if(data207 === "false" || data207 === 0 || data207 === null){coerced127 = false;}else if(data207 === "true" || data207 === 1){coerced127 = true;}else {const err268 = {instancePath:instancePath+"/instrumentation/@nestjs~1core/enabled",schemaPath:"instrumentation.js/properties/%40nestjs~1core/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err268];}else {vErrors.push(err268);}errors++;}}if(coerced127 !== undefined){data207 = coerced127;if(data206 !== undefined){data206["enabled"] = coerced127;}}}}}else {const err269 = {instancePath:instancePath+"/instrumentation/@nestjs~1core",schemaPath:"instrumentation.js/properties/%40nestjs~1core/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err269];}else {vErrors.push(err269);}errors++;}}if(data173["@node-redis/client"] !== undefined){let data208 = data173["@node-redis/client"];if(data208 && typeof data208 == "object" && !Array.isArray(data208)){if(data208.enabled !== undefined){let data209 = data208.enabled;if(typeof data209 !== "boolean"){let coerced128 = undefined;if(!(coerced128 !== undefined)){if(data209 === "false" || data209 === 0 || data209 === null){coerced128 = false;}else if(data209 === "true" || data209 === 1){coerced128 = true;}else {const err270 = {instancePath:instancePath+"/instrumentation/@node-redis~1client/enabled",schemaPath:"instrumentation.js/properties/%40node-redis~1client/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err270];}else {vErrors.push(err270);}errors++;}}if(coerced128 !== undefined){data209 = coerced128;if(data208 !== undefined){data208["enabled"] = coerced128;}}}}}else {const err271 = {instancePath:instancePath+"/instrumentation/@node-redis~1client",schemaPath:"instrumentation.js/properties/%40node-redis~1client/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err271];}else {vErrors.push(err271);}errors++;}}if(data173["@opensearch-project/opensearch"] !== undefined){let data210 = data173["@opensearch-project/opensearch"];if(data210 && typeof data210 == "object" && !Array.isArray(data210)){if(data210.enabled !== undefined){let data211 = data210.enabled;if(typeof data211 !== "boolean"){let coerced129 = undefined;if(!(coerced129 !== undefined)){if(data211 === "false" || data211 === 0 || data211 === null){coerced129 = false;}else if(data211 === "true" || data211 === 1){coerced129 = true;}else {const err272 = {instancePath:instancePath+"/instrumentation/@opensearch-project~1opensearch/enabled",schemaPath:"instrumentation.js/properties/%40opensearch-project~1opensearch/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err272];}else {vErrors.push(err272);}errors++;}}if(coerced129 !== undefined){data211 = coerced129;if(data210 !== undefined){data210["enabled"] = coerced129;}}}}}else {const err273 = {instancePath:instancePath+"/instrumentation/@opensearch-project~1opensearch",schemaPath:"instrumentation.js/properties/%40opensearch-project~1opensearch/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err273];}else {vErrors.push(err273);}errors++;}}if(data173["@prisma/client"] !== undefined){let data212 = data173["@prisma/client"];if(data212 && typeof data212 == "object" && !Array.isArray(data212)){if(data212.enabled !== undefined){let data213 = data212.enabled;if(typeof data213 !== "boolean"){let coerced130 = undefined;if(!(coerced130 !== undefined)){if(data213 === "false" || data213 === 0 || data213 === null){coerced130 = false;}else if(data213 === "true" || data213 === 1){coerced130 = true;}else {const err274 = {instancePath:instancePath+"/instrumentation/@prisma~1client/enabled",schemaPath:"instrumentation.js/properties/%40prisma~1client/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err274];}else {vErrors.push(err274);}errors++;}}if(coerced130 !== undefined){data213 = coerced130;if(data212 !== undefined){data212["enabled"] = coerced130;}}}}}else {const err275 = {instancePath:instancePath+"/instrumentation/@prisma~1client",schemaPath:"instrumentation.js/properties/%40prisma~1client/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err275];}else {vErrors.push(err275);}errors++;}}if(data173["@redis/client"] !== undefined){let data214 = data173["@redis/client"];if(data214 && typeof data214 == "object" && !Array.isArray(data214)){if(data214.enabled !== undefined){let data215 = data214.enabled;if(typeof data215 !== "boolean"){let coerced131 = undefined;if(!(coerced131 !== undefined)){if(data215 === "false" || data215 === 0 || data215 === null){coerced131 = false;}else if(data215 === "true" || data215 === 1){coerced131 = true;}else {const err276 = {instancePath:instancePath+"/instrumentation/@redis~1client/enabled",schemaPath:"instrumentation.js/properties/%40redis~1client/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err276];}else {vErrors.push(err276);}errors++;}}if(coerced131 !== undefined){data215 = coerced131;if(data214 !== undefined){data214["enabled"] = coerced131;}}}}}else {const err277 = {instancePath:instancePath+"/instrumentation/@redis~1client",schemaPath:"instrumentation.js/properties/%40redis~1client/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err277];}else {vErrors.push(err277);}errors++;}}if(data173["@smithy/core"] !== undefined){let data216 = data173["@smithy/core"];if(data216 && typeof data216 == "object" && !Array.isArray(data216)){if(data216.enabled !== undefined){let data217 = data216.enabled;if(typeof data217 !== "boolean"){let coerced132 = undefined;if(!(coerced132 !== undefined)){if(data217 === "false" || data217 === 0 || data217 === null){coerced132 = false;}else if(data217 === "true" || data217 === 1){coerced132 = true;}else {const err278 = {instancePath:instancePath+"/instrumentation/@smithy~1core/enabled",schemaPath:"instrumentation.js/properties/%40smithy~1core/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err278];}else {vErrors.push(err278);}errors++;}}if(coerced132 !== undefined){data217 = coerced132;if(data216 !== undefined){data216["enabled"] = coerced132;}}}}}else {const err279 = {instancePath:instancePath+"/instrumentation/@smithy~1core",schemaPath:"instrumentation.js/properties/%40smithy~1core/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err279];}else {vErrors.push(err279);}errors++;}}if(data173["@smithy/smithy-client"] !== undefined){let data218 = data173["@smithy/smithy-client"];if(data218 && typeof data218 == "object" && !Array.isArray(data218)){if(data218.enabled !== undefined){let data219 = data218.enabled;if(typeof data219 !== "boolean"){let coerced133 = undefined;if(!(coerced133 !== undefined)){if(data219 === "false" || data219 === 0 || data219 === null){coerced133 = false;}else if(data219 === "true" || data219 === 1){coerced133 = true;}else {const err280 = {instancePath:instancePath+"/instrumentation/@smithy~1smithy-client/enabled",schemaPath:"instrumentation.js/properties/%40smithy~1smithy-client/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err280];}else {vErrors.push(err280);}errors++;}}if(coerced133 !== undefined){data219 = coerced133;if(data218 !== undefined){data218["enabled"] = coerced133;}}}}}else {const err281 = {instancePath:instancePath+"/instrumentation/@smithy~1smithy-client",schemaPath:"instrumentation.js/properties/%40smithy~1smithy-client/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err281];}else {vErrors.push(err281);}errors++;}}if(data173.amqplib !== undefined){let data220 = data173.amqplib;if(data220 && typeof data220 == "object" && !Array.isArray(data220)){if(data220.enabled !== undefined){let data221 = data220.enabled;if(typeof data221 !== "boolean"){let coerced134 = undefined;if(!(coerced134 !== undefined)){if(data221 === "false" || data221 === 0 || data221 === null){coerced134 = false;}else if(data221 === "true" || data221 === 1){coerced134 = true;}else {const err282 = {instancePath:instancePath+"/instrumentation/amqplib/enabled",schemaPath:"instrumentation.js/properties/amqplib/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err282];}else {vErrors.push(err282);}errors++;}}if(coerced134 !== undefined){data221 = coerced134;if(data220 !== undefined){data220["enabled"] = coerced134;}}}}}else {const err283 = {instancePath:instancePath+"/instrumentation/amqplib",schemaPath:"instrumentation.js/properties/amqplib/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err283];}else {vErrors.push(err283);}errors++;}}if(data173["amqplib/callback_api"] !== undefined){let data222 = data173["amqplib/callback_api"];if(data222 && typeof data222 == "object" && !Array.isArray(data222)){if(data222.enabled !== undefined){let data223 = data222.enabled;if(typeof data223 !== "boolean"){let coerced135 = undefined;if(!(coerced135 !== undefined)){if(data223 === "false" || data223 === 0 || data223 === null){coerced135 = false;}else if(data223 === "true" || data223 === 1){coerced135 = true;}else {const err284 = {instancePath:instancePath+"/instrumentation/amqplib~1callback_api/enabled",schemaPath:"instrumentation.js/properties/amqplib~1callback_api/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err284];}else {vErrors.push(err284);}errors++;}}if(coerced135 !== undefined){data223 = coerced135;if(data222 !== undefined){data222["enabled"] = coerced135;}}}}}else {const err285 = {instancePath:instancePath+"/instrumentation/amqplib~1callback_api",schemaPath:"instrumentation.js/properties/amqplib~1callback_api/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err285];}else {vErrors.push(err285);}errors++;}}if(data173["aws-sdk"] !== undefined){let data224 = data173["aws-sdk"];if(data224 && typeof data224 == "object" && !Array.isArray(data224)){if(data224.enabled !== undefined){let data225 = data224.enabled;if(typeof data225 !== "boolean"){let coerced136 = undefined;if(!(coerced136 !== undefined)){if(data225 === "false" || data225 === 0 || data225 === null){coerced136 = false;}else if(data225 === "true" || data225 === 1){coerced136 = true;}else {const err286 = {instancePath:instancePath+"/instrumentation/aws-sdk/enabled",schemaPath:"instrumentation.js/properties/aws-sdk/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err286];}else {vErrors.push(err286);}errors++;}}if(coerced136 !== undefined){data225 = coerced136;if(data224 !== undefined){data224["enabled"] = coerced136;}}}}}else {const err287 = {instancePath:instancePath+"/instrumentation/aws-sdk",schemaPath:"instrumentation.js/properties/aws-sdk/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err287];}else {vErrors.push(err287);}errors++;}}if(data173.bluebird !== undefined){let data226 = data173.bluebird;if(data226 && typeof data226 == "object" && !Array.isArray(data226)){if(data226.enabled !== undefined){let data227 = data226.enabled;if(typeof data227 !== "boolean"){let coerced137 = undefined;if(!(coerced137 !== undefined)){if(data227 === "false" || data227 === 0 || data227 === null){coerced137 = false;}else if(data227 === "true" || data227 === 1){coerced137 = true;}else {const err288 = {instancePath:instancePath+"/instrumentation/bluebird/enabled",schemaPath:"instrumentation.js/properties/bluebird/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err288];}else {vErrors.push(err288);}errors++;}}if(coerced137 !== undefined){data227 = coerced137;if(data226 !== undefined){data226["enabled"] = coerced137;}}}}}else {const err289 = {instancePath:instancePath+"/instrumentation/bluebird",schemaPath:"instrumentation.js/properties/bluebird/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err289];}else {vErrors.push(err289);}errors++;}}if(data173.bunyan !== undefined){let data228 = data173.bunyan;if(data228 && typeof data228 == "object" && !Array.isArray(data228)){if(data228.enabled !== undefined){let data229 = data228.enabled;if(typeof data229 !== "boolean"){let coerced138 = undefined;if(!(coerced138 !== undefined)){if(data229 === "false" || data229 === 0 || data229 === null){coerced138 = false;}else if(data229 === "true" || data229 === 1){coerced138 = true;}else {const err290 = {instancePath:instancePath+"/instrumentation/bunyan/enabled",schemaPath:"instrumentation.js/properties/bunyan/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err290];}else {vErrors.push(err290);}errors++;}}if(coerced138 !== undefined){data229 = coerced138;if(data228 !== undefined){data228["enabled"] = coerced138;}}}}}else {const err291 = {instancePath:instancePath+"/instrumentation/bunyan",schemaPath:"instrumentation.js/properties/bunyan/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err291];}else {vErrors.push(err291);}errors++;}}if(data173["cassandra-driver"] !== undefined){let data230 = data173["cassandra-driver"];if(data230 && typeof data230 == "object" && !Array.isArray(data230)){if(data230.enabled !== undefined){let data231 = data230.enabled;if(typeof data231 !== "boolean"){let coerced139 = undefined;if(!(coerced139 !== undefined)){if(data231 === "false" || data231 === 0 || data231 === null){coerced139 = false;}else if(data231 === "true" || data231 === 1){coerced139 = true;}else {const err292 = {instancePath:instancePath+"/instrumentation/cassandra-driver/enabled",schemaPath:"instrumentation.js/properties/cassandra-driver/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err292];}else {vErrors.push(err292);}errors++;}}if(coerced139 !== undefined){data231 = coerced139;if(data230 !== undefined){data230["enabled"] = coerced139;}}}}}else {const err293 = {instancePath:instancePath+"/instrumentation/cassandra-driver",schemaPath:"instrumentation.js/properties/cassandra-driver/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err293];}else {vErrors.push(err293);}errors++;}}if(data173.child_process !== undefined){let data232 = data173.child_process;if(data232 && typeof data232 == "object" && !Array.isArray(data232)){if(data232.enabled !== undefined){let data233 = data232.enabled;if(typeof data233 !== "boolean"){let coerced140 = undefined;if(!(coerced140 !== undefined)){if(data233 === "false" || data233 === 0 || data233 === null){coerced140 = false;}else if(data233 === "true" || data233 === 1){coerced140 = true;}else {const err294 = {instancePath:instancePath+"/instrumentation/child_process/enabled",schemaPath:"instrumentation.js/properties/child_process/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err294];}else {vErrors.push(err294);}errors++;}}if(coerced140 !== undefined){data233 = coerced140;if(data232 !== undefined){data232["enabled"] = coerced140;}}}}}else {const err295 = {instancePath:instancePath+"/instrumentation/child_process",schemaPath:"instrumentation.js/properties/child_process/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err295];}else {vErrors.push(err295);}errors++;}}if(data173.connect !== undefined){let data234 = data173.connect;if(data234 && typeof data234 == "object" && !Array.isArray(data234)){if(data234.enabled !== undefined){let data235 = data234.enabled;if(typeof data235 !== "boolean"){let coerced141 = undefined;if(!(coerced141 !== undefined)){if(data235 === "false" || data235 === 0 || data235 === null){coerced141 = false;}else if(data235 === "true" || data235 === 1){coerced141 = true;}else {const err296 = {instancePath:instancePath+"/instrumentation/connect/enabled",schemaPath:"instrumentation.js/properties/connect/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err296];}else {vErrors.push(err296);}errors++;}}if(coerced141 !== undefined){data235 = coerced141;if(data234 !== undefined){data234["enabled"] = coerced141;}}}}}else {const err297 = {instancePath:instancePath+"/instrumentation/connect",schemaPath:"instrumentation.js/properties/connect/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err297];}else {vErrors.push(err297);}errors++;}}if(data173.crypto !== undefined){let data236 = data173.crypto;if(data236 && typeof data236 == "object" && !Array.isArray(data236)){if(data236.enabled !== undefined){let data237 = data236.enabled;if(typeof data237 !== "boolean"){let coerced142 = undefined;if(!(coerced142 !== undefined)){if(data237 === "false" || data237 === 0 || data237 === null){coerced142 = false;}else if(data237 === "true" || data237 === 1){coerced142 = true;}else {const err298 = {instancePath:instancePath+"/instrumentation/crypto/enabled",schemaPath:"instrumentation.js/properties/crypto/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err298];}else {vErrors.push(err298);}errors++;}}if(coerced142 !== undefined){data237 = coerced142;if(data236 !== undefined){data236["enabled"] = coerced142;}}}}}else {const err299 = {instancePath:instancePath+"/instrumentation/crypto",schemaPath:"instrumentation.js/properties/crypto/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err299];}else {vErrors.push(err299);}errors++;}}if(data173.dns !== undefined){let data238 = data173.dns;if(data238 && typeof data238 == "object" && !Array.isArray(data238)){if(data238.enabled !== undefined){let data239 = data238.enabled;if(typeof data239 !== "boolean"){let coerced143 = undefined;if(!(coerced143 !== undefined)){if(data239 === "false" || data239 === 0 || data239 === null){coerced143 = false;}else if(data239 === "true" || data239 === 1){coerced143 = true;}else {const err300 = {instancePath:instancePath+"/instrumentation/dns/enabled",schemaPath:"instrumentation.js/properties/dns/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err300];}else {vErrors.push(err300);}errors++;}}if(coerced143 !== undefined){data239 = coerced143;if(data238 !== undefined){data238["enabled"] = coerced143;}}}}}else {const err301 = {instancePath:instancePath+"/instrumentation/dns",schemaPath:"instrumentation.js/properties/dns/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err301];}else {vErrors.push(err301);}errors++;}}if(data173.express !== undefined){let data240 = data173.express;if(data240 && typeof data240 == "object" && !Array.isArray(data240)){if(data240.enabled !== undefined){let data241 = data240.enabled;if(typeof data241 !== "boolean"){let coerced144 = undefined;if(!(coerced144 !== undefined)){if(data241 === "false" || data241 === 0 || data241 === null){coerced144 = false;}else if(data241 === "true" || data241 === 1){coerced144 = true;}else {const err302 = {instancePath:instancePath+"/instrumentation/express/enabled",schemaPath:"instrumentation.js/properties/express/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err302];}else {vErrors.push(err302);}errors++;}}if(coerced144 !== undefined){data241 = coerced144;if(data240 !== undefined){data240["enabled"] = coerced144;}}}}}else {const err303 = {instancePath:instancePath+"/instrumentation/express",schemaPath:"instrumentation.js/properties/express/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err303];}else {vErrors.push(err303);}errors++;}}if(data173.fastify !== undefined){let data242 = data173.fastify;if(data242 && typeof data242 == "object" && !Array.isArray(data242)){if(data242.enabled !== undefined){let data243 = data242.enabled;if(typeof data243 !== "boolean"){let coerced145 = undefined;if(!(coerced145 !== undefined)){if(data243 === "false" || data243 === 0 || data243 === null){coerced145 = false;}else if(data243 === "true" || data243 === 1){coerced145 = true;}else {const err304 = {instancePath:instancePath+"/instrumentation/fastify/enabled",schemaPath:"instrumentation.js/properties/fastify/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err304];}else {vErrors.push(err304);}errors++;}}if(coerced145 !== undefined){data243 = coerced145;if(data242 !== undefined){data242["enabled"] = coerced145;}}}}}else {const err305 = {instancePath:instancePath+"/instrumentation/fastify",schemaPath:"instrumentation.js/properties/fastify/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err305];}else {vErrors.push(err305);}errors++;}}if(data173.fs !== undefined){let data244 = data173.fs;if(data244 && typeof data244 == "object" && !Array.isArray(data244)){if(data244.enabled !== undefined){let data245 = data244.enabled;if(typeof data245 !== "boolean"){let coerced146 = undefined;if(!(coerced146 !== undefined)){if(data245 === "false" || data245 === 0 || data245 === null){coerced146 = false;}else if(data245 === "true" || data245 === 1){coerced146 = true;}else {const err306 = {instancePath:instancePath+"/instrumentation/fs/enabled",schemaPath:"instrumentation.js/properties/fs/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err306];}else {vErrors.push(err306);}errors++;}}if(coerced146 !== undefined){data245 = coerced146;if(data244 !== undefined){data244["enabled"] = coerced146;}}}}}else {const err307 = {instancePath:instancePath+"/instrumentation/fs",schemaPath:"instrumentation.js/properties/fs/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err307];}else {vErrors.push(err307);}errors++;}}if(data173.http !== undefined){let data246 = data173.http;if(data246 && typeof data246 == "object" && !Array.isArray(data246)){if(data246.enabled !== undefined){let data247 = data246.enabled;if(typeof data247 !== "boolean"){let coerced147 = undefined;if(!(coerced147 !== undefined)){if(data247 === "false" || data247 === 0 || data247 === null){coerced147 = false;}else if(data247 === "true" || data247 === 1){coerced147 = true;}else {const err308 = {instancePath:instancePath+"/instrumentation/http/enabled",schemaPath:"instrumentation.js/properties/http/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err308];}else {vErrors.push(err308);}errors++;}}if(coerced147 !== undefined){data247 = coerced147;if(data246 !== undefined){data246["enabled"] = coerced147;}}}}}else {const err309 = {instancePath:instancePath+"/instrumentation/http",schemaPath:"instrumentation.js/properties/http/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err309];}else {vErrors.push(err309);}errors++;}}if(data173.http2 !== undefined){let data248 = data173.http2;if(data248 && typeof data248 == "object" && !Array.isArray(data248)){if(data248.enabled !== undefined){let data249 = data248.enabled;if(typeof data249 !== "boolean"){let coerced148 = undefined;if(!(coerced148 !== undefined)){if(data249 === "false" || data249 === 0 || data249 === null){coerced148 = false;}else if(data249 === "true" || data249 === 1){coerced148 = true;}else {const err310 = {instancePath:instancePath+"/instrumentation/http2/enabled",schemaPath:"instrumentation.js/properties/http2/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err310];}else {vErrors.push(err310);}errors++;}}if(coerced148 !== undefined){data249 = coerced148;if(data248 !== undefined){data248["enabled"] = coerced148;}}}}}else {const err311 = {instancePath:instancePath+"/instrumentation/http2",schemaPath:"instrumentation.js/properties/http2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err311];}else {vErrors.push(err311);}errors++;}}if(data173.https !== undefined){let data250 = data173.https;if(data250 && typeof data250 == "object" && !Array.isArray(data250)){if(data250.enabled !== undefined){let data251 = data250.enabled;if(typeof data251 !== "boolean"){let coerced149 = undefined;if(!(coerced149 !== undefined)){if(data251 === "false" || data251 === 0 || data251 === null){coerced149 = false;}else if(data251 === "true" || data251 === 1){coerced149 = true;}else {const err312 = {instancePath:instancePath+"/instrumentation/https/enabled",schemaPath:"instrumentation.js/properties/https/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err312];}else {vErrors.push(err312);}errors++;}}if(coerced149 !== undefined){data251 = coerced149;if(data250 !== undefined){data250["enabled"] = coerced149;}}}}}else {const err313 = {instancePath:instancePath+"/instrumentation/https",schemaPath:"instrumentation.js/properties/https/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err313];}else {vErrors.push(err313);}errors++;}}if(data173.ioredis !== undefined){let data252 = data173.ioredis;if(data252 && typeof data252 == "object" && !Array.isArray(data252)){if(data252.enabled !== undefined){let data253 = data252.enabled;if(typeof data253 !== "boolean"){let coerced150 = undefined;if(!(coerced150 !== undefined)){if(data253 === "false" || data253 === 0 || data253 === null){coerced150 = false;}else if(data253 === "true" || data253 === 1){coerced150 = true;}else {const err314 = {instancePath:instancePath+"/instrumentation/ioredis/enabled",schemaPath:"instrumentation.js/properties/ioredis/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err314];}else {vErrors.push(err314);}errors++;}}if(coerced150 !== undefined){data253 = coerced150;if(data252 !== undefined){data252["enabled"] = coerced150;}}}}}else {const err315 = {instancePath:instancePath+"/instrumentation/ioredis",schemaPath:"instrumentation.js/properties/ioredis/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err315];}else {vErrors.push(err315);}errors++;}}if(data173.iovalkey !== undefined){let data254 = data173.iovalkey;if(data254 && typeof data254 == "object" && !Array.isArray(data254)){if(data254.enabled !== undefined){let data255 = data254.enabled;if(typeof data255 !== "boolean"){let coerced151 = undefined;if(!(coerced151 !== undefined)){if(data255 === "false" || data255 === 0 || data255 === null){coerced151 = false;}else if(data255 === "true" || data255 === 1){coerced151 = true;}else {const err316 = {instancePath:instancePath+"/instrumentation/iovalkey/enabled",schemaPath:"instrumentation.js/properties/iovalkey/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err316];}else {vErrors.push(err316);}errors++;}}if(coerced151 !== undefined){data255 = coerced151;if(data254 !== undefined){data254["enabled"] = coerced151;}}}}}else {const err317 = {instancePath:instancePath+"/instrumentation/iovalkey",schemaPath:"instrumentation.js/properties/iovalkey/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err317];}else {vErrors.push(err317);}errors++;}}if(data173.kafkajs !== undefined){let data256 = data173.kafkajs;if(data256 && typeof data256 == "object" && !Array.isArray(data256)){if(data256.enabled !== undefined){let data257 = data256.enabled;if(typeof data257 !== "boolean"){let coerced152 = undefined;if(!(coerced152 !== undefined)){if(data257 === "false" || data257 === 0 || data257 === null){coerced152 = false;}else if(data257 === "true" || data257 === 1){coerced152 = true;}else {const err318 = {instancePath:instancePath+"/instrumentation/kafkajs/enabled",schemaPath:"instrumentation.js/properties/kafkajs/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err318];}else {vErrors.push(err318);}errors++;}}if(coerced152 !== undefined){data257 = coerced152;if(data256 !== undefined){data256["enabled"] = coerced152;}}}}}else {const err319 = {instancePath:instancePath+"/instrumentation/kafkajs",schemaPath:"instrumentation.js/properties/kafkajs/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err319];}else {vErrors.push(err319);}errors++;}}if(data173.koa !== undefined){let data258 = data173.koa;if(data258 && typeof data258 == "object" && !Array.isArray(data258)){if(data258.enabled !== undefined){let data259 = data258.enabled;if(typeof data259 !== "boolean"){let coerced153 = undefined;if(!(coerced153 !== undefined)){if(data259 === "false" || data259 === 0 || data259 === null){coerced153 = false;}else if(data259 === "true" || data259 === 1){coerced153 = true;}else {const err320 = {instancePath:instancePath+"/instrumentation/koa/enabled",schemaPath:"instrumentation.js/properties/koa/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err320];}else {vErrors.push(err320);}errors++;}}if(coerced153 !== undefined){data259 = coerced153;if(data258 !== undefined){data258["enabled"] = coerced153;}}}}}else {const err321 = {instancePath:instancePath+"/instrumentation/koa",schemaPath:"instrumentation.js/properties/koa/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err321];}else {vErrors.push(err321);}errors++;}}if(data173.memcached !== undefined){let data260 = data173.memcached;if(data260 && typeof data260 == "object" && !Array.isArray(data260)){if(data260.enabled !== undefined){let data261 = data260.enabled;if(typeof data261 !== "boolean"){let coerced154 = undefined;if(!(coerced154 !== undefined)){if(data261 === "false" || data261 === 0 || data261 === null){coerced154 = false;}else if(data261 === "true" || data261 === 1){coerced154 = true;}else {const err322 = {instancePath:instancePath+"/instrumentation/memcached/enabled",schemaPath:"instrumentation.js/properties/memcached/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err322];}else {vErrors.push(err322);}errors++;}}if(coerced154 !== undefined){data261 = coerced154;if(data260 !== undefined){data260["enabled"] = coerced154;}}}}}else {const err323 = {instancePath:instancePath+"/instrumentation/memcached",schemaPath:"instrumentation.js/properties/memcached/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err323];}else {vErrors.push(err323);}errors++;}}if(data173.mongodb !== undefined){let data262 = data173.mongodb;if(data262 && typeof data262 == "object" && !Array.isArray(data262)){if(data262.enabled !== undefined){let data263 = data262.enabled;if(typeof data263 !== "boolean"){let coerced155 = undefined;if(!(coerced155 !== undefined)){if(data263 === "false" || data263 === 0 || data263 === null){coerced155 = false;}else if(data263 === "true" || data263 === 1){coerced155 = true;}else {const err324 = {instancePath:instancePath+"/instrumentation/mongodb/enabled",schemaPath:"instrumentation.js/properties/mongodb/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err324];}else {vErrors.push(err324);}errors++;}}if(coerced155 !== undefined){data263 = coerced155;if(data262 !== undefined){data262["enabled"] = coerced155;}}}}}else {const err325 = {instancePath:instancePath+"/instrumentation/mongodb",schemaPath:"instrumentation.js/properties/mongodb/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err325];}else {vErrors.push(err325);}errors++;}}if(data173.mysql !== undefined){let data264 = data173.mysql;if(data264 && typeof data264 == "object" && !Array.isArray(data264)){if(data264.enabled !== undefined){let data265 = data264.enabled;if(typeof data265 !== "boolean"){let coerced156 = undefined;if(!(coerced156 !== undefined)){if(data265 === "false" || data265 === 0 || data265 === null){coerced156 = false;}else if(data265 === "true" || data265 === 1){coerced156 = true;}else {const err326 = {instancePath:instancePath+"/instrumentation/mysql/enabled",schemaPath:"instrumentation.js/properties/mysql/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err326];}else {vErrors.push(err326);}errors++;}}if(coerced156 !== undefined){data265 = coerced156;if(data264 !== undefined){data264["enabled"] = coerced156;}}}}}else {const err327 = {instancePath:instancePath+"/instrumentation/mysql",schemaPath:"instrumentation.js/properties/mysql/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err327];}else {vErrors.push(err327);}errors++;}}if(data173.mysql2 !== undefined){let data266 = data173.mysql2;if(data266 && typeof data266 == "object" && !Array.isArray(data266)){if(data266.enabled !== undefined){let data267 = data266.enabled;if(typeof data267 !== "boolean"){let coerced157 = undefined;if(!(coerced157 !== undefined)){if(data267 === "false" || data267 === 0 || data267 === null){coerced157 = false;}else if(data267 === "true" || data267 === 1){coerced157 = true;}else {const err328 = {instancePath:instancePath+"/instrumentation/mysql2/enabled",schemaPath:"instrumentation.js/properties/mysql2/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err328];}else {vErrors.push(err328);}errors++;}}if(coerced157 !== undefined){data267 = coerced157;if(data266 !== undefined){data266["enabled"] = coerced157;}}}}}else {const err329 = {instancePath:instancePath+"/instrumentation/mysql2",schemaPath:"instrumentation.js/properties/mysql2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err329];}else {vErrors.push(err329);}errors++;}}if(data173.net !== undefined){let data268 = data173.net;if(data268 && typeof data268 == "object" && !Array.isArray(data268)){if(data268.enabled !== undefined){let data269 = data268.enabled;if(typeof data269 !== "boolean"){let coerced158 = undefined;if(!(coerced158 !== undefined)){if(data269 === "false" || data269 === 0 || data269 === null){coerced158 = false;}else if(data269 === "true" || data269 === 1){coerced158 = true;}else {const err330 = {instancePath:instancePath+"/instrumentation/net/enabled",schemaPath:"instrumentation.js/properties/net/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err330];}else {vErrors.push(err330);}errors++;}}if(coerced158 !== undefined){data269 = coerced158;if(data268 !== undefined){data268["enabled"] = coerced158;}}}}}else {const err331 = {instancePath:instancePath+"/instrumentation/net",schemaPath:"instrumentation.js/properties/net/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err331];}else {vErrors.push(err331);}errors++;}}if(data173.next !== undefined){let data270 = data173.next;if(data270 && typeof data270 == "object" && !Array.isArray(data270)){if(data270.enabled !== undefined){let data271 = data270.enabled;if(typeof data271 !== "boolean"){let coerced159 = undefined;if(!(coerced159 !== undefined)){if(data271 === "false" || data271 === 0 || data271 === null){coerced159 = false;}else if(data271 === "true" || data271 === 1){coerced159 = true;}else {const err332 = {instancePath:instancePath+"/instrumentation/next/enabled",schemaPath:"instrumentation.js/properties/next/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err332];}else {vErrors.push(err332);}errors++;}}if(coerced159 !== undefined){data271 = coerced159;if(data270 !== undefined){data270["enabled"] = coerced159;}}}}}else {const err333 = {instancePath:instancePath+"/instrumentation/next",schemaPath:"instrumentation.js/properties/next/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err333];}else {vErrors.push(err333);}errors++;}}if(data173.openai !== undefined){let data272 = data173.openai;if(data272 && typeof data272 == "object" && !Array.isArray(data272)){if(data272.enabled !== undefined){let data273 = data272.enabled;if(typeof data273 !== "boolean"){let coerced160 = undefined;if(!(coerced160 !== undefined)){if(data273 === "false" || data273 === 0 || data273 === null){coerced160 = false;}else if(data273 === "true" || data273 === 1){coerced160 = true;}else {const err334 = {instancePath:instancePath+"/instrumentation/openai/enabled",schemaPath:"instrumentation.js/properties/openai/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err334];}else {vErrors.push(err334);}errors++;}}if(coerced160 !== undefined){data273 = coerced160;if(data272 !== undefined){data272["enabled"] = coerced160;}}}}}else {const err335 = {instancePath:instancePath+"/instrumentation/openai",schemaPath:"instrumentation.js/properties/openai/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err335];}else {vErrors.push(err335);}errors++;}}if(data173.pg !== undefined){let data274 = data173.pg;if(data274 && typeof data274 == "object" && !Array.isArray(data274)){if(data274.enabled !== undefined){let data275 = data274.enabled;if(typeof data275 !== "boolean"){let coerced161 = undefined;if(!(coerced161 !== undefined)){if(data275 === "false" || data275 === 0 || data275 === null){coerced161 = false;}else if(data275 === "true" || data275 === 1){coerced161 = true;}else {const err336 = {instancePath:instancePath+"/instrumentation/pg/enabled",schemaPath:"instrumentation.js/properties/pg/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err336];}else {vErrors.push(err336);}errors++;}}if(coerced161 !== undefined){data275 = coerced161;if(data274 !== undefined){data274["enabled"] = coerced161;}}}}}else {const err337 = {instancePath:instancePath+"/instrumentation/pg",schemaPath:"instrumentation.js/properties/pg/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err337];}else {vErrors.push(err337);}errors++;}}if(data173.pino !== undefined){let data276 = data173.pino;if(data276 && typeof data276 == "object" && !Array.isArray(data276)){if(data276.enabled !== undefined){let data277 = data276.enabled;if(typeof data277 !== "boolean"){let coerced162 = undefined;if(!(coerced162 !== undefined)){if(data277 === "false" || data277 === 0 || data277 === null){coerced162 = false;}else if(data277 === "true" || data277 === 1){coerced162 = true;}else {const err338 = {instancePath:instancePath+"/instrumentation/pino/enabled",schemaPath:"instrumentation.js/properties/pino/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err338];}else {vErrors.push(err338);}errors++;}}if(coerced162 !== undefined){data277 = coerced162;if(data276 !== undefined){data276["enabled"] = coerced162;}}}}}else {const err339 = {instancePath:instancePath+"/instrumentation/pino",schemaPath:"instrumentation.js/properties/pino/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err339];}else {vErrors.push(err339);}errors++;}}if(data173.q !== undefined){let data278 = data173.q;if(data278 && typeof data278 == "object" && !Array.isArray(data278)){if(data278.enabled !== undefined){let data279 = data278.enabled;if(typeof data279 !== "boolean"){let coerced163 = undefined;if(!(coerced163 !== undefined)){if(data279 === "false" || data279 === 0 || data279 === null){coerced163 = false;}else if(data279 === "true" || data279 === 1){coerced163 = true;}else {const err340 = {instancePath:instancePath+"/instrumentation/q/enabled",schemaPath:"instrumentation.js/properties/q/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err340];}else {vErrors.push(err340);}errors++;}}if(coerced163 !== undefined){data279 = coerced163;if(data278 !== undefined){data278["enabled"] = coerced163;}}}}}else {const err341 = {instancePath:instancePath+"/instrumentation/q",schemaPath:"instrumentation.js/properties/q/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err341];}else {vErrors.push(err341);}errors++;}}if(data173.redis !== undefined){let data280 = data173.redis;if(data280 && typeof data280 == "object" && !Array.isArray(data280)){if(data280.enabled !== undefined){let data281 = data280.enabled;if(typeof data281 !== "boolean"){let coerced164 = undefined;if(!(coerced164 !== undefined)){if(data281 === "false" || data281 === 0 || data281 === null){coerced164 = false;}else if(data281 === "true" || data281 === 1){coerced164 = true;}else {const err342 = {instancePath:instancePath+"/instrumentation/redis/enabled",schemaPath:"instrumentation.js/properties/redis/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err342];}else {vErrors.push(err342);}errors++;}}if(coerced164 !== undefined){data281 = coerced164;if(data280 !== undefined){data280["enabled"] = coerced164;}}}}}else {const err343 = {instancePath:instancePath+"/instrumentation/redis",schemaPath:"instrumentation.js/properties/redis/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err343];}else {vErrors.push(err343);}errors++;}}if(data173.restify !== undefined){let data282 = data173.restify;if(data282 && typeof data282 == "object" && !Array.isArray(data282)){if(data282.enabled !== undefined){let data283 = data282.enabled;if(typeof data283 !== "boolean"){let coerced165 = undefined;if(!(coerced165 !== undefined)){if(data283 === "false" || data283 === 0 || data283 === null){coerced165 = false;}else if(data283 === "true" || data283 === 1){coerced165 = true;}else {const err344 = {instancePath:instancePath+"/instrumentation/restify/enabled",schemaPath:"instrumentation.js/properties/restify/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err344];}else {vErrors.push(err344);}errors++;}}if(coerced165 !== undefined){data283 = coerced165;if(data282 !== undefined){data282["enabled"] = coerced165;}}}}}else {const err345 = {instancePath:instancePath+"/instrumentation/restify",schemaPath:"instrumentation.js/properties/restify/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err345];}else {vErrors.push(err345);}errors++;}}if(data173.router !== undefined){let data284 = data173.router;if(data284 && typeof data284 == "object" && !Array.isArray(data284)){if(data284.enabled !== undefined){let data285 = data284.enabled;if(typeof data285 !== "boolean"){let coerced166 = undefined;if(!(coerced166 !== undefined)){if(data285 === "false" || data285 === 0 || data285 === null){coerced166 = false;}else if(data285 === "true" || data285 === 1){coerced166 = true;}else {const err346 = {instancePath:instancePath+"/instrumentation/router/enabled",schemaPath:"instrumentation.js/properties/router/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err346];}else {vErrors.push(err346);}errors++;}}if(coerced166 !== undefined){data285 = coerced166;if(data284 !== undefined){data284["enabled"] = coerced166;}}}}}else {const err347 = {instancePath:instancePath+"/instrumentation/router",schemaPath:"instrumentation.js/properties/router/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err347];}else {vErrors.push(err347);}errors++;}}if(data173.undici !== undefined){let data286 = data173.undici;if(data286 && typeof data286 == "object" && !Array.isArray(data286)){if(data286.enabled !== undefined){let data287 = data286.enabled;if(typeof data287 !== "boolean"){let coerced167 = undefined;if(!(coerced167 !== undefined)){if(data287 === "false" || data287 === 0 || data287 === null){coerced167 = false;}else if(data287 === "true" || data287 === 1){coerced167 = true;}else {const err348 = {instancePath:instancePath+"/instrumentation/undici/enabled",schemaPath:"instrumentation.js/properties/undici/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err348];}else {vErrors.push(err348);}errors++;}}if(coerced167 !== undefined){data287 = coerced167;if(data286 !== undefined){data286["enabled"] = coerced167;}}}}}else {const err349 = {instancePath:instancePath+"/instrumentation/undici",schemaPath:"instrumentation.js/properties/undici/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err349];}else {vErrors.push(err349);}errors++;}}if(data173.when !== undefined){let data288 = data173.when;if(data288 && typeof data288 == "object" && !Array.isArray(data288)){if(data288.enabled !== undefined){let data289 = data288.enabled;if(typeof data289 !== "boolean"){let coerced168 = undefined;if(!(coerced168 !== undefined)){if(data289 === "false" || data289 === 0 || data289 === null){coerced168 = false;}else if(data289 === "true" || data289 === 1){coerced168 = true;}else {const err350 = {instancePath:instancePath+"/instrumentation/when/enabled",schemaPath:"instrumentation.js/properties/when/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err350];}else {vErrors.push(err350);}errors++;}}if(coerced168 !== undefined){data289 = coerced168;if(data288 !== undefined){data288["enabled"] = coerced168;}}}}}else {const err351 = {instancePath:instancePath+"/instrumentation/when",schemaPath:"instrumentation.js/properties/when/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err351];}else {vErrors.push(err351);}errors++;}}if(data173.winston !== undefined){let data290 = data173.winston;if(data290 && typeof data290 == "object" && !Array.isArray(data290)){if(data290.enabled !== undefined){let data291 = data290.enabled;if(typeof data291 !== "boolean"){let coerced169 = undefined;if(!(coerced169 !== undefined)){if(data291 === "false" || data291 === 0 || data291 === null){coerced169 = false;}else if(data291 === "true" || data291 === 1){coerced169 = true;}else {const err352 = {instancePath:instancePath+"/instrumentation/winston/enabled",schemaPath:"instrumentation.js/properties/winston/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err352];}else {vErrors.push(err352);}errors++;}}if(coerced169 !== undefined){data291 = coerced169;if(data290 !== undefined){data290["enabled"] = coerced169;}}}}}else {const err353 = {instancePath:instancePath+"/instrumentation/winston",schemaPath:"instrumentation.js/properties/winston/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err353];}else {vErrors.push(err353);}errors++;}}if(data173.zlib !== undefined){let data292 = data173.zlib;if(data292 && typeof data292 == "object" && !Array.isArray(data292)){if(data292.enabled !== undefined){let data293 = data292.enabled;if(typeof data293 !== "boolean"){let coerced170 = undefined;if(!(coerced170 !== undefined)){if(data293 === "false" || data293 === 0 || data293 === null){coerced170 = false;}else if(data293 === "true" || data293 === 1){coerced170 = true;}else {const err354 = {instancePath:instancePath+"/instrumentation/zlib/enabled",schemaPath:"instrumentation.js/properties/zlib/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err354];}else {vErrors.push(err354);}errors++;}}if(coerced170 !== undefined){data293 = coerced170;if(data292 !== undefined){data292["enabled"] = coerced170;}}}}}else {const err355 = {instancePath:instancePath+"/instrumentation/zlib",schemaPath:"instrumentation.js/properties/zlib/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err355];}else {vErrors.push(err355);}errors++;}}}else {const err356 = {instancePath:instancePath+"/instrumentation",schemaPath:"instrumentation.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err356];}else {vErrors.push(err356);}errors++;}}if(data.kafka !== undefined){let data294 = data.kafka;if(data294 && typeof data294 == "object" && !Array.isArray(data294)){if(data294.metrics !== undefined){let data295 = data294.metrics;if(data295 && typeof data295 == "object" && !Array.isArray(data295)){if(data295.cluster !== undefined){let data296 = data295.cluster;if(data296 && typeof data296 == "object" && !Array.isArray(data296)){if(data296.metrics !== undefined){let data297 = data296.metrics;if(data297 && typeof data297 == "object" && !Array.isArray(data297)){if(data297.enabled !== undefined){let data298 = data297.enabled;if(typeof data298 !== "boolean"){let coerced171 = undefined;if(!(coerced171 !== undefined)){if(data298 === "false" || data298 === 0 || data298 === null){coerced171 = false;}else if(data298 === "true" || data298 === 1){coerced171 = true;}else {const err357 = {instancePath:instancePath+"/kafka/metrics/cluster/metrics/enabled",schemaPath:"kafka.js/properties/metrics/properties/cluster/properties/metrics/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err357];}else {vErrors.push(err357);}errors++;}}if(coerced171 !== undefined){data298 = coerced171;if(data297 !== undefined){data297["enabled"] = coerced171;}}}}}else {const err358 = {instancePath:instancePath+"/kafka/metrics/cluster/metrics",schemaPath:"kafka.js/properties/metrics/properties/cluster/properties/metrics/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err358];}else {vErrors.push(err358);}errors++;}}}else {const err359 = {instancePath:instancePath+"/kafka/metrics/cluster",schemaPath:"kafka.js/properties/metrics/properties/cluster/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err359];}else {vErrors.push(err359);}errors++;}}}else {const err360 = {instancePath:instancePath+"/kafka/metrics",schemaPath:"kafka.js/properties/metrics/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err360];}else {vErrors.push(err360);}errors++;}}}else {const err361 = {instancePath:instancePath+"/kafka",schemaPath:"kafka.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err361];}else {vErrors.push(err361);}errors++;}}if(data.logging !== undefined){let data299 = data.logging;if(data299 && typeof data299 == "object" && !Array.isArray(data299)){if(data299.level !== undefined){let data300 = data299.level;if(typeof data300 !== "string"){let dataType172 = typeof data300;let coerced172 = undefined;if(!(coerced172 !== undefined)){if(dataType172 == "number" || dataType172 == "boolean"){coerced172 = "" + data300;}else if(data300 === null){coerced172 = "";}else {const err362 = {instancePath:instancePath+"/logging/level",schemaPath:"logging.js/properties/level/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err362];}else {vErrors.push(err362);}errors++;}}if(coerced172 !== undefined){data300 = coerced172;if(data299 !== undefined){data299["level"] = coerced172;}}}}if(data299.filepath !== undefined){let data301 = data299.filepath;if(typeof data301 !== "string"){let dataType173 = typeof data301;let coerced173 = undefined;if(!(coerced173 !== undefined)){if(dataType173 == "number" || dataType173 == "boolean"){coerced173 = "" + data301;}else if(data301 === null){coerced173 = "";}else {const err363 = {instancePath:instancePath+"/logging/filepath",schemaPath:"logging.js/properties/filepath/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err363];}else {vErrors.push(err363);}errors++;}}if(coerced173 !== undefined){data301 = coerced173;if(data299 !== undefined){data299["filepath"] = coerced173;}}}}if(data299.enabled !== undefined){let data302 = data299.enabled;if(typeof data302 !== "boolean"){let coerced174 = undefined;if(!(coerced174 !== undefined)){if(data302 === "false" || data302 === 0 || data302 === null){coerced174 = false;}else if(data302 === "true" || data302 === 1){coerced174 = true;}else {const err364 = {instancePath:instancePath+"/logging/enabled",schemaPath:"logging.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err364];}else {vErrors.push(err364);}errors++;}}if(coerced174 !== undefined){data302 = coerced174;if(data299 !== undefined){data299["enabled"] = coerced174;}}}}if(data299.diagnostics !== undefined){let data303 = data299.diagnostics;if(typeof data303 !== "boolean"){let coerced175 = undefined;if(!(coerced175 !== undefined)){if(data303 === "false" || data303 === 0 || data303 === null){coerced175 = false;}else if(data303 === "true" || data303 === 1){coerced175 = true;}else {const err365 = {instancePath:instancePath+"/logging/diagnostics",schemaPath:"logging.js/properties/diagnostics/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err365];}else {vErrors.push(err365);}errors++;}}if(coerced175 !== undefined){data303 = coerced175;if(data299 !== undefined){data299["diagnostics"] = coerced175;}}}}}else {const err366 = {instancePath:instancePath+"/logging",schemaPath:"logging.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err366];}else {vErrors.push(err366);}errors++;}}if(data.message_tracer !== undefined){let data304 = data.message_tracer;if(data304 && typeof data304 == "object" && !Array.isArray(data304)){if(data304.segment_parameters !== undefined){let data305 = data304.segment_parameters;if(data305 && typeof data305 == "object" && !Array.isArray(data305)){if(data305.enabled !== undefined){let data306 = data305.enabled;if(typeof data306 !== "boolean"){let coerced176 = undefined;if(!(coerced176 !== undefined)){if(data306 === "false" || data306 === 0 || data306 === null){coerced176 = false;}else if(data306 === "true" || data306 === 1){coerced176 = true;}else {const err367 = {instancePath:instancePath+"/message_tracer/segment_parameters/enabled",schemaPath:"message-tracer.js/properties/segment_parameters/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err367];}else {vErrors.push(err367);}errors++;}}if(coerced176 !== undefined){data306 = coerced176;if(data305 !== undefined){data305["enabled"] = coerced176;}}}}}else {const err368 = {instancePath:instancePath+"/message_tracer/segment_parameters",schemaPath:"message-tracer.js/properties/segment_parameters/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err368];}else {vErrors.push(err368);}errors++;}}}else {const err369 = {instancePath:instancePath+"/message_tracer",schemaPath:"message-tracer.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err369];}else {vErrors.push(err369);}errors++;}}if(data.opentelemetry !== undefined){let data307 = data.opentelemetry;if(data307 && typeof data307 == "object" && !Array.isArray(data307)){if(data307.enabled !== undefined){let data308 = data307.enabled;if(typeof data308 !== "boolean"){let coerced177 = undefined;if(!(coerced177 !== undefined)){if(data308 === "false" || data308 === 0 || data308 === null){coerced177 = false;}else if(data308 === "true" || data308 === 1){coerced177 = true;}else {const err370 = {instancePath:instancePath+"/opentelemetry/enabled",schemaPath:"opentelemetry.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err370];}else {vErrors.push(err370);}errors++;}}if(coerced177 !== undefined){data308 = coerced177;if(data307 !== undefined){data307["enabled"] = coerced177;}}}}if(data307.traces !== undefined){let data309 = data307.traces;if(data309 && typeof data309 == "object" && !Array.isArray(data309)){if(data309.enabled !== undefined){let data310 = data309.enabled;if(typeof data310 !== "boolean"){let coerced178 = undefined;if(!(coerced178 !== undefined)){if(data310 === "false" || data310 === 0 || data310 === null){coerced178 = false;}else if(data310 === "true" || data310 === 1){coerced178 = true;}else {const err371 = {instancePath:instancePath+"/opentelemetry/traces/enabled",schemaPath:"opentelemetry.js/properties/traces/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err371];}else {vErrors.push(err371);}errors++;}}if(coerced178 !== undefined){data310 = coerced178;if(data309 !== undefined){data309["enabled"] = coerced178;}}}}}else {const err372 = {instancePath:instancePath+"/opentelemetry/traces",schemaPath:"opentelemetry.js/properties/traces/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err372];}else {vErrors.push(err372);}errors++;}}if(data307.logs !== undefined){let data311 = data307.logs;if(data311 && typeof data311 == "object" && !Array.isArray(data311)){if(data311.enabled !== undefined){let data312 = data311.enabled;if(typeof data312 !== "boolean"){let coerced179 = undefined;if(!(coerced179 !== undefined)){if(data312 === "false" || data312 === 0 || data312 === null){coerced179 = false;}else if(data312 === "true" || data312 === 1){coerced179 = true;}else {const err373 = {instancePath:instancePath+"/opentelemetry/logs/enabled",schemaPath:"opentelemetry.js/properties/logs/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err373];}else {vErrors.push(err373);}errors++;}}if(coerced179 !== undefined){data312 = coerced179;if(data311 !== undefined){data311["enabled"] = coerced179;}}}}}else {const err374 = {instancePath:instancePath+"/opentelemetry/logs",schemaPath:"opentelemetry.js/properties/logs/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err374];}else {vErrors.push(err374);}errors++;}}if(data307.metrics !== undefined){let data313 = data307.metrics;if(data313 && typeof data313 == "object" && !Array.isArray(data313)){if(data313.enabled !== undefined){let data314 = data313.enabled;if(typeof data314 !== "boolean"){let coerced180 = undefined;if(!(coerced180 !== undefined)){if(data314 === "false" || data314 === 0 || data314 === null){coerced180 = false;}else if(data314 === "true" || data314 === 1){coerced180 = true;}else {const err375 = {instancePath:instancePath+"/opentelemetry/metrics/enabled",schemaPath:"opentelemetry.js/properties/metrics/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err375];}else {vErrors.push(err375);}errors++;}}if(coerced180 !== undefined){data314 = coerced180;if(data313 !== undefined){data313["enabled"] = coerced180;}}}}if(data313.export_interval !== undefined){let data315 = data313.export_interval;if(!((typeof data315 == "number") && (!(data315 % 1) && !isNaN(data315)))){let dataType181 = typeof data315;let coerced181 = undefined;if(!(coerced181 !== undefined)){if(dataType181 === "boolean" || data315 === null
                  || (dataType181 === "string" && data315 && data315 == +data315 && !(data315 % 1))){coerced181 = +data315;}else {const err376 = {instancePath:instancePath+"/opentelemetry/metrics/export_interval",schemaPath:"opentelemetry.js/properties/metrics/properties/export_interval/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err376];}else {vErrors.push(err376);}errors++;}}if(coerced181 !== undefined){data315 = coerced181;if(data313 !== undefined){data313["export_interval"] = coerced181;}}}}if(data313.export_timeout !== undefined){let data316 = data313.export_timeout;if(!((typeof data316 == "number") && (!(data316 % 1) && !isNaN(data316)))){let dataType182 = typeof data316;let coerced182 = undefined;if(!(coerced182 !== undefined)){if(dataType182 === "boolean" || data316 === null
                  || (dataType182 === "string" && data316 && data316 == +data316 && !(data316 % 1))){coerced182 = +data316;}else {const err377 = {instancePath:instancePath+"/opentelemetry/metrics/export_timeout",schemaPath:"opentelemetry.js/properties/metrics/properties/export_timeout/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err377];}else {vErrors.push(err377);}errors++;}}if(coerced182 !== undefined){data316 = coerced182;if(data313 !== undefined){data313["export_timeout"] = coerced182;}}}}}else {const err378 = {instancePath:instancePath+"/opentelemetry/metrics",schemaPath:"opentelemetry.js/properties/metrics/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err378];}else {vErrors.push(err378);}errors++;}}}else {const err379 = {instancePath:instancePath+"/opentelemetry",schemaPath:"opentelemetry.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err379];}else {vErrors.push(err379);}errors++;}}if(data.plugins !== undefined){let data317 = data.plugins;if(data317 && typeof data317 == "object" && !Array.isArray(data317)){if(data317.native_metrics !== undefined){let data318 = data317.native_metrics;if(data318 && typeof data318 == "object" && !Array.isArray(data318)){if(data318.enabled !== undefined){let data319 = data318.enabled;if(typeof data319 !== "boolean"){let coerced183 = undefined;if(!(coerced183 !== undefined)){if(data319 === "false" || data319 === 0 || data319 === null){coerced183 = false;}else if(data319 === "true" || data319 === 1){coerced183 = true;}else {const err380 = {instancePath:instancePath+"/plugins/native_metrics/enabled",schemaPath:"plugins.js/properties/native_metrics/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err380];}else {vErrors.push(err380);}errors++;}}if(coerced183 !== undefined){data319 = coerced183;if(data318 !== undefined){data318["enabled"] = coerced183;}}}}}else {const err381 = {instancePath:instancePath+"/plugins/native_metrics",schemaPath:"plugins.js/properties/native_metrics/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err381];}else {vErrors.push(err381);}errors++;}}}else {const err382 = {instancePath:instancePath+"/plugins",schemaPath:"plugins.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err382];}else {vErrors.push(err382);}errors++;}}if(data.process_host !== undefined){let data320 = data.process_host;if(data320 && typeof data320 == "object" && !Array.isArray(data320)){if(data320.display_name !== undefined){let data321 = data320.display_name;if(typeof data321 !== "string"){let dataType184 = typeof data321;let coerced184 = undefined;if(!(coerced184 !== undefined)){if(dataType184 == "number" || dataType184 == "boolean"){coerced184 = "" + data321;}else if(data321 === null){coerced184 = "";}else {const err383 = {instancePath:instancePath+"/process_host/display_name",schemaPath:"process-host.js/properties/display_name/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err383];}else {vErrors.push(err383);}errors++;}}if(coerced184 !== undefined){data321 = coerced184;if(data320 !== undefined){data320["display_name"] = coerced184;}}}}if(data320.ipv_preference !== undefined){let data322 = data320.ipv_preference;if(typeof data322 !== "string"){let dataType185 = typeof data322;let coerced185 = undefined;if(!(coerced185 !== undefined)){if(dataType185 == "number" || dataType185 == "boolean"){coerced185 = "" + data322;}else if(data322 === null){coerced185 = "";}else {const err384 = {instancePath:instancePath+"/process_host/ipv_preference",schemaPath:"process-host.js/properties/ipv_preference/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err384];}else {vErrors.push(err384);}errors++;}}if(coerced185 !== undefined){data322 = coerced185;if(data320 !== undefined){data320["ipv_preference"] = coerced185;}}}if(!((data322 === "4") || (data322 === "6"))){const err385 = {instancePath:instancePath+"/process_host/ipv_preference",schemaPath:"process-host.js/properties/ipv_preference/enum",keyword:"enum",params:{allowedValues: schema55.properties.ipv_preference.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err385];}else {vErrors.push(err385);}errors++;}}}else {const err386 = {instancePath:instancePath+"/process_host",schemaPath:"process-host.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err386];}else {vErrors.push(err386);}errors++;}}if(data.profiling !== undefined){let data323 = data.profiling;if(data323 && typeof data323 == "object" && !Array.isArray(data323)){if(data323.enabled !== undefined){let data324 = data323.enabled;if(typeof data324 !== "boolean"){let coerced186 = undefined;if(!(coerced186 !== undefined)){if(data324 === "false" || data324 === 0 || data324 === null){coerced186 = false;}else if(data324 === "true" || data324 === 1){coerced186 = true;}else {const err387 = {instancePath:instancePath+"/profiling/enabled",schemaPath:"profiling.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err387];}else {vErrors.push(err387);}errors++;}}if(coerced186 !== undefined){data324 = coerced186;if(data323 !== undefined){data323["enabled"] = coerced186;}}}}if(data323.include !== undefined){let data325 = data323.include;if(Array.isArray(data325)){const len15 = data325.length;for(let i15=0; i15<len15; i15++){let data326 = data325[i15];if(typeof data326 !== "string"){let dataType187 = typeof data326;let coerced187 = undefined;if(!(coerced187 !== undefined)){if(dataType187 == "number" || dataType187 == "boolean"){coerced187 = "" + data326;}else if(data326 === null){coerced187 = "";}else {const err388 = {instancePath:instancePath+"/profiling/include/" + i15,schemaPath:"profiling.js/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err388];}else {vErrors.push(err388);}errors++;}}if(coerced187 !== undefined){data326 = coerced187;if(data325 !== undefined){data325[i15] = coerced187;}}}}}else {const err389 = {instancePath:instancePath+"/profiling/include",schemaPath:"profiling.js/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err389];}else {vErrors.push(err389);}errors++;}}if(data323.delay !== undefined){let data327 = data323.delay;if(!((typeof data327 == "number") && (!(data327 % 1) && !isNaN(data327)))){let dataType188 = typeof data327;let coerced188 = undefined;if(!(coerced188 !== undefined)){if(dataType188 === "boolean" || data327 === null
                  || (dataType188 === "string" && data327 && data327 == +data327 && !(data327 % 1))){coerced188 = +data327;}else {const err390 = {instancePath:instancePath+"/profiling/delay",schemaPath:"profiling.js/properties/delay/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err390];}else {vErrors.push(err390);}errors++;}}if(coerced188 !== undefined){data327 = coerced188;if(data323 !== undefined){data323["delay"] = coerced188;}}}}if(data323.duration !== undefined){let data328 = data323.duration;if(!((typeof data328 == "number") && (!(data328 % 1) && !isNaN(data328)))){let dataType189 = typeof data328;let coerced189 = undefined;if(!(coerced189 !== undefined)){if(dataType189 === "boolean" || data328 === null
                  || (dataType189 === "string" && data328 && data328 == +data328 && !(data328 % 1))){coerced189 = +data328;}else {const err391 = {instancePath:instancePath+"/profiling/duration",schemaPath:"profiling.js/properties/duration/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err391];}else {vErrors.push(err391);}errors++;}}if(coerced189 !== undefined){data328 = coerced189;if(data323 !== undefined){data323["duration"] = coerced189;}}}}if(data323.source_mapping !== undefined){let data329 = data323.source_mapping;if(data329 && typeof data329 == "object" && !Array.isArray(data329)){if(data329.enabled !== undefined){let data330 = data329.enabled;if(typeof data330 !== "boolean"){let coerced190 = undefined;if(!(coerced190 !== undefined)){if(data330 === "false" || data330 === 0 || data330 === null){coerced190 = false;}else if(data330 === "true" || data330 === 1){coerced190 = true;}else {const err392 = {instancePath:instancePath+"/profiling/source_mapping/enabled",schemaPath:"profiling.js/properties/source_mapping/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err392];}else {vErrors.push(err392);}errors++;}}if(coerced190 !== undefined){data330 = coerced190;if(data329 !== undefined){data329["enabled"] = coerced190;}}}}}else {const err393 = {instancePath:instancePath+"/profiling/source_mapping",schemaPath:"profiling.js/properties/source_mapping/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err393];}else {vErrors.push(err393);}errors++;}}if(data323.sample_interval !== undefined){let data331 = data323.sample_interval;if(!((typeof data331 == "number") && (!(data331 % 1) && !isNaN(data331)))){let dataType191 = typeof data331;let coerced191 = undefined;if(!(coerced191 !== undefined)){if(dataType191 === "boolean" || data331 === null
                  || (dataType191 === "string" && data331 && data331 == +data331 && !(data331 % 1))){coerced191 = +data331;}else {const err394 = {instancePath:instancePath+"/profiling/sample_interval",schemaPath:"profiling.js/properties/sample_interval/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err394];}else {vErrors.push(err394);}errors++;}}if(coerced191 !== undefined){data331 = coerced191;if(data323 !== undefined){data323["sample_interval"] = coerced191;}}}}}else {const err395 = {instancePath:instancePath+"/profiling",schemaPath:"profiling.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err395];}else {vErrors.push(err395);}errors++;}}if(data.rules !== undefined){let data332 = data.rules;if(data332 && typeof data332 == "object" && !Array.isArray(data332)){if(data332.name !== undefined){if(!(Array.isArray(data332.name))){const err396 = {instancePath:instancePath+"/rules/name",schemaPath:"rules.js/properties/name/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err396];}else {vErrors.push(err396);}errors++;}}if(data332.ignore !== undefined){let data334 = data332.ignore;if(Array.isArray(data334)){const len16 = data334.length;for(let i16=0; i16<len16; i16++){let data335 = data334[i16];if((typeof data335 !== "string") && (!(data335 && typeof data335 == "object" && !Array.isArray(data335)))){let dataType192 = typeof data335;let coerced192 = undefined;if(!(coerced192 !== undefined)){if(dataType192 == "number" || dataType192 == "boolean"){coerced192 = "" + data335;}else if(data335 === null){coerced192 = "";}else {const err397 = {instancePath:instancePath+"/rules/ignore/" + i16,schemaPath:"rules.js/properties/ignore/items/type",keyword:"type",params:{type: schema57.properties.ignore.items.type},message:"must be string,object"};if(vErrors === null){vErrors = [err397];}else {vErrors.push(err397);}errors++;}}if(coerced192 !== undefined){data335 = coerced192;if(data334 !== undefined){data334[i16] = coerced192;}}}}}else {const err398 = {instancePath:instancePath+"/rules/ignore",schemaPath:"rules.js/properties/ignore/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err398];}else {vErrors.push(err398);}errors++;}}}else {const err399 = {instancePath:instancePath+"/rules",schemaPath:"rules.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err399];}else {vErrors.push(err399);}errors++;}}if(data.security !== undefined){let data336 = data.security;if(data336 && typeof data336 == "object" && !Array.isArray(data336)){if(data336.enabled !== undefined){let data337 = data336.enabled;if(typeof data337 !== "boolean"){let coerced193 = undefined;if(!(coerced193 !== undefined)){if(data337 === "false" || data337 === 0 || data337 === null){coerced193 = false;}else if(data337 === "true" || data337 === 1){coerced193 = true;}else {const err400 = {instancePath:instancePath+"/security/enabled",schemaPath:"security.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err400];}else {vErrors.push(err400);}errors++;}}if(coerced193 !== undefined){data337 = coerced193;if(data336 !== undefined){data336["enabled"] = coerced193;}}}}if(data336.agent !== undefined){let data338 = data336.agent;if(data338 && typeof data338 == "object" && !Array.isArray(data338)){if(data338.enabled !== undefined){let data339 = data338.enabled;if(typeof data339 !== "boolean"){let coerced194 = undefined;if(!(coerced194 !== undefined)){if(data339 === "false" || data339 === 0 || data339 === null){coerced194 = false;}else if(data339 === "true" || data339 === 1){coerced194 = true;}else {const err401 = {instancePath:instancePath+"/security/agent/enabled",schemaPath:"security.js/properties/agent/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err401];}else {vErrors.push(err401);}errors++;}}if(coerced194 !== undefined){data339 = coerced194;if(data338 !== undefined){data338["enabled"] = coerced194;}}}}}else {const err402 = {instancePath:instancePath+"/security/agent",schemaPath:"security.js/properties/agent/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err402];}else {vErrors.push(err402);}errors++;}}if(data336.mode !== undefined){let data340 = data336.mode;if(typeof data340 !== "string"){let dataType195 = typeof data340;let coerced195 = undefined;if(!(coerced195 !== undefined)){if(dataType195 == "number" || dataType195 == "boolean"){coerced195 = "" + data340;}else if(data340 === null){coerced195 = "";}else {const err403 = {instancePath:instancePath+"/security/mode",schemaPath:"security.js/properties/mode/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err403];}else {vErrors.push(err403);}errors++;}}if(coerced195 !== undefined){data340 = coerced195;if(data336 !== undefined){data336["mode"] = coerced195;}}}if(!((data340 === "IAST") || (data340 === "RASP"))){const err404 = {instancePath:instancePath+"/security/mode",schemaPath:"security.js/properties/mode/enum",keyword:"enum",params:{allowedValues: schema58.properties.mode.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err404];}else {vErrors.push(err404);}errors++;}}if(data336.validator_service_url !== undefined){let data341 = data336.validator_service_url;if(typeof data341 !== "string"){let dataType196 = typeof data341;let coerced196 = undefined;if(!(coerced196 !== undefined)){if(dataType196 == "number" || dataType196 == "boolean"){coerced196 = "" + data341;}else if(data341 === null){coerced196 = "";}else {const err405 = {instancePath:instancePath+"/security/validator_service_url",schemaPath:"security.js/properties/validator_service_url/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err405];}else {vErrors.push(err405);}errors++;}}if(coerced196 !== undefined){data341 = coerced196;if(data336 !== undefined){data336["validator_service_url"] = coerced196;}}}}if(data336.detection !== undefined){let data342 = data336.detection;if(data342 && typeof data342 == "object" && !Array.isArray(data342)){if(data342.rci !== undefined){let data343 = data342.rci;if(data343 && typeof data343 == "object" && !Array.isArray(data343)){if(data343.enabled !== undefined){let data344 = data343.enabled;if(typeof data344 !== "boolean"){let coerced197 = undefined;if(!(coerced197 !== undefined)){if(data344 === "false" || data344 === 0 || data344 === null){coerced197 = false;}else if(data344 === "true" || data344 === 1){coerced197 = true;}else {const err406 = {instancePath:instancePath+"/security/detection/rci/enabled",schemaPath:"security.js/properties/detection/properties/rci/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err406];}else {vErrors.push(err406);}errors++;}}if(coerced197 !== undefined){data344 = coerced197;if(data343 !== undefined){data343["enabled"] = coerced197;}}}}}else {const err407 = {instancePath:instancePath+"/security/detection/rci",schemaPath:"security.js/properties/detection/properties/rci/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err407];}else {vErrors.push(err407);}errors++;}}if(data342.rxss !== undefined){let data345 = data342.rxss;if(data345 && typeof data345 == "object" && !Array.isArray(data345)){if(data345.enabled !== undefined){let data346 = data345.enabled;if(typeof data346 !== "boolean"){let coerced198 = undefined;if(!(coerced198 !== undefined)){if(data346 === "false" || data346 === 0 || data346 === null){coerced198 = false;}else if(data346 === "true" || data346 === 1){coerced198 = true;}else {const err408 = {instancePath:instancePath+"/security/detection/rxss/enabled",schemaPath:"security.js/properties/detection/properties/rxss/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err408];}else {vErrors.push(err408);}errors++;}}if(coerced198 !== undefined){data346 = coerced198;if(data345 !== undefined){data345["enabled"] = coerced198;}}}}}else {const err409 = {instancePath:instancePath+"/security/detection/rxss",schemaPath:"security.js/properties/detection/properties/rxss/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err409];}else {vErrors.push(err409);}errors++;}}if(data342.deserialization !== undefined){let data347 = data342.deserialization;if(data347 && typeof data347 == "object" && !Array.isArray(data347)){if(data347.enabled !== undefined){let data348 = data347.enabled;if(typeof data348 !== "boolean"){let coerced199 = undefined;if(!(coerced199 !== undefined)){if(data348 === "false" || data348 === 0 || data348 === null){coerced199 = false;}else if(data348 === "true" || data348 === 1){coerced199 = true;}else {const err410 = {instancePath:instancePath+"/security/detection/deserialization/enabled",schemaPath:"security.js/properties/detection/properties/deserialization/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err410];}else {vErrors.push(err410);}errors++;}}if(coerced199 !== undefined){data348 = coerced199;if(data347 !== undefined){data347["enabled"] = coerced199;}}}}}else {const err411 = {instancePath:instancePath+"/security/detection/deserialization",schemaPath:"security.js/properties/detection/properties/deserialization/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err411];}else {vErrors.push(err411);}errors++;}}}else {const err412 = {instancePath:instancePath+"/security/detection",schemaPath:"security.js/properties/detection/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err412];}else {vErrors.push(err412);}errors++;}}if(data336.iast_test_identifier !== undefined){let data349 = data336.iast_test_identifier;if(typeof data349 !== "string"){let dataType200 = typeof data349;let coerced200 = undefined;if(!(coerced200 !== undefined)){if(dataType200 == "number" || dataType200 == "boolean"){coerced200 = "" + data349;}else if(data349 === null){coerced200 = "";}else {const err413 = {instancePath:instancePath+"/security/iast_test_identifier",schemaPath:"security.js/properties/iast_test_identifier/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err413];}else {vErrors.push(err413);}errors++;}}if(coerced200 !== undefined){data349 = coerced200;if(data336 !== undefined){data336["iast_test_identifier"] = coerced200;}}}}if(data336.scan_controllers !== undefined){let data350 = data336.scan_controllers;if(data350 && typeof data350 == "object" && !Array.isArray(data350)){if(data350.iast_scan_request_rate_limit !== undefined){let data351 = data350.iast_scan_request_rate_limit;if(!((typeof data351 == "number") && (!(data351 % 1) && !isNaN(data351)))){let dataType201 = typeof data351;let coerced201 = undefined;if(!(coerced201 !== undefined)){if(dataType201 === "boolean" || data351 === null
                  || (dataType201 === "string" && data351 && data351 == +data351 && !(data351 % 1))){coerced201 = +data351;}else {const err414 = {instancePath:instancePath+"/security/scan_controllers/iast_scan_request_rate_limit",schemaPath:"security.js/properties/scan_controllers/properties/iast_scan_request_rate_limit/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err414];}else {vErrors.push(err414);}errors++;}}if(coerced201 !== undefined){data351 = coerced201;if(data350 !== undefined){data350["iast_scan_request_rate_limit"] = coerced201;}}}}if(data350.scan_instance_count !== undefined){let data352 = data350.scan_instance_count;if(!((typeof data352 == "number") && (!(data352 % 1) && !isNaN(data352)))){let dataType202 = typeof data352;let coerced202 = undefined;if(!(coerced202 !== undefined)){if(dataType202 === "boolean" || data352 === null
                  || (dataType202 === "string" && data352 && data352 == +data352 && !(data352 % 1))){coerced202 = +data352;}else {const err415 = {instancePath:instancePath+"/security/scan_controllers/scan_instance_count",schemaPath:"security.js/properties/scan_controllers/properties/scan_instance_count/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err415];}else {vErrors.push(err415);}errors++;}}if(coerced202 !== undefined){data352 = coerced202;if(data350 !== undefined){data350["scan_instance_count"] = coerced202;}}}}}else {const err416 = {instancePath:instancePath+"/security/scan_controllers",schemaPath:"security.js/properties/scan_controllers/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err416];}else {vErrors.push(err416);}errors++;}}if(data336.scan_schedule !== undefined){let data353 = data336.scan_schedule;if(data353 && typeof data353 == "object" && !Array.isArray(data353)){if(data353.delay !== undefined){let data354 = data353.delay;if(!((typeof data354 == "number") && (!(data354 % 1) && !isNaN(data354)))){let dataType203 = typeof data354;let coerced203 = undefined;if(!(coerced203 !== undefined)){if(dataType203 === "boolean" || data354 === null
                  || (dataType203 === "string" && data354 && data354 == +data354 && !(data354 % 1))){coerced203 = +data354;}else {const err417 = {instancePath:instancePath+"/security/scan_schedule/delay",schemaPath:"security.js/properties/scan_schedule/properties/delay/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err417];}else {vErrors.push(err417);}errors++;}}if(coerced203 !== undefined){data354 = coerced203;if(data353 !== undefined){data353["delay"] = coerced203;}}}}if(data353.duration !== undefined){let data355 = data353.duration;if(!((typeof data355 == "number") && (!(data355 % 1) && !isNaN(data355)))){let dataType204 = typeof data355;let coerced204 = undefined;if(!(coerced204 !== undefined)){if(dataType204 === "boolean" || data355 === null
                  || (dataType204 === "string" && data355 && data355 == +data355 && !(data355 % 1))){coerced204 = +data355;}else {const err418 = {instancePath:instancePath+"/security/scan_schedule/duration",schemaPath:"security.js/properties/scan_schedule/properties/duration/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err418];}else {vErrors.push(err418);}errors++;}}if(coerced204 !== undefined){data355 = coerced204;if(data353 !== undefined){data353["duration"] = coerced204;}}}}if(data353.schedule !== undefined){let data356 = data353.schedule;if(typeof data356 !== "string"){let dataType205 = typeof data356;let coerced205 = undefined;if(!(coerced205 !== undefined)){if(dataType205 == "number" || dataType205 == "boolean"){coerced205 = "" + data356;}else if(data356 === null){coerced205 = "";}else {const err419 = {instancePath:instancePath+"/security/scan_schedule/schedule",schemaPath:"security.js/properties/scan_schedule/properties/schedule/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err419];}else {vErrors.push(err419);}errors++;}}if(coerced205 !== undefined){data356 = coerced205;if(data353 !== undefined){data353["schedule"] = coerced205;}}}}if(data353.always_sample_traces !== undefined){let data357 = data353.always_sample_traces;if(typeof data357 !== "boolean"){let coerced206 = undefined;if(!(coerced206 !== undefined)){if(data357 === "false" || data357 === 0 || data357 === null){coerced206 = false;}else if(data357 === "true" || data357 === 1){coerced206 = true;}else {const err420 = {instancePath:instancePath+"/security/scan_schedule/always_sample_traces",schemaPath:"security.js/properties/scan_schedule/properties/always_sample_traces/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err420];}else {vErrors.push(err420);}errors++;}}if(coerced206 !== undefined){data357 = coerced206;if(data353 !== undefined){data353["always_sample_traces"] = coerced206;}}}}}else {const err421 = {instancePath:instancePath+"/security/scan_schedule",schemaPath:"security.js/properties/scan_schedule/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err421];}else {vErrors.push(err421);}errors++;}}if(data336.exclude_from_iast_scan !== undefined){let data358 = data336.exclude_from_iast_scan;if(data358 && typeof data358 == "object" && !Array.isArray(data358)){if(data358.api !== undefined){let data359 = data358.api;if(Array.isArray(data359)){const len17 = data359.length;for(let i17=0; i17<len17; i17++){let data360 = data359[i17];if(typeof data360 !== "string"){let dataType207 = typeof data360;let coerced207 = undefined;if(!(coerced207 !== undefined)){if(dataType207 == "number" || dataType207 == "boolean"){coerced207 = "" + data360;}else if(data360 === null){coerced207 = "";}else {const err422 = {instancePath:instancePath+"/security/exclude_from_iast_scan/api/" + i17,schemaPath:"security.js/properties/exclude_from_iast_scan/properties/api/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err422];}else {vErrors.push(err422);}errors++;}}if(coerced207 !== undefined){data360 = coerced207;if(data359 !== undefined){data359[i17] = coerced207;}}}}}else {const err423 = {instancePath:instancePath+"/security/exclude_from_iast_scan/api",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/api/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err423];}else {vErrors.push(err423);}errors++;}}if(data358.http_request_parameters !== undefined){let data361 = data358.http_request_parameters;if(data361 && typeof data361 == "object" && !Array.isArray(data361)){if(data361.header !== undefined){let data362 = data361.header;if(Array.isArray(data362)){const len18 = data362.length;for(let i18=0; i18<len18; i18++){let data363 = data362[i18];if(typeof data363 !== "string"){let dataType208 = typeof data363;let coerced208 = undefined;if(!(coerced208 !== undefined)){if(dataType208 == "number" || dataType208 == "boolean"){coerced208 = "" + data363;}else if(data363 === null){coerced208 = "";}else {const err424 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/header/" + i18,schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/header/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err424];}else {vErrors.push(err424);}errors++;}}if(coerced208 !== undefined){data363 = coerced208;if(data362 !== undefined){data362[i18] = coerced208;}}}}}else {const err425 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/header",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/header/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err425];}else {vErrors.push(err425);}errors++;}}if(data361.query !== undefined){let data364 = data361.query;if(Array.isArray(data364)){const len19 = data364.length;for(let i19=0; i19<len19; i19++){let data365 = data364[i19];if(typeof data365 !== "string"){let dataType209 = typeof data365;let coerced209 = undefined;if(!(coerced209 !== undefined)){if(dataType209 == "number" || dataType209 == "boolean"){coerced209 = "" + data365;}else if(data365 === null){coerced209 = "";}else {const err426 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/query/" + i19,schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/query/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err426];}else {vErrors.push(err426);}errors++;}}if(coerced209 !== undefined){data365 = coerced209;if(data364 !== undefined){data364[i19] = coerced209;}}}}}else {const err427 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/query",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/query/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err427];}else {vErrors.push(err427);}errors++;}}if(data361.body !== undefined){let data366 = data361.body;if(Array.isArray(data366)){const len20 = data366.length;for(let i20=0; i20<len20; i20++){let data367 = data366[i20];if(typeof data367 !== "string"){let dataType210 = typeof data367;let coerced210 = undefined;if(!(coerced210 !== undefined)){if(dataType210 == "number" || dataType210 == "boolean"){coerced210 = "" + data367;}else if(data367 === null){coerced210 = "";}else {const err428 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/body/" + i20,schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/body/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err428];}else {vErrors.push(err428);}errors++;}}if(coerced210 !== undefined){data367 = coerced210;if(data366 !== undefined){data366[i20] = coerced210;}}}}}else {const err429 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/body",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/body/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err429];}else {vErrors.push(err429);}errors++;}}}else {const err430 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err430];}else {vErrors.push(err430);}errors++;}}if(data358.iast_detection_category !== undefined){let data368 = data358.iast_detection_category;if(data368 && typeof data368 == "object" && !Array.isArray(data368)){if(data368.insecure_settings !== undefined){let data369 = data368.insecure_settings;if(typeof data369 !== "boolean"){let coerced211 = undefined;if(!(coerced211 !== undefined)){if(data369 === "false" || data369 === 0 || data369 === null){coerced211 = false;}else if(data369 === "true" || data369 === 1){coerced211 = true;}else {const err431 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/insecure_settings",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/insecure_settings/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err431];}else {vErrors.push(err431);}errors++;}}if(coerced211 !== undefined){data369 = coerced211;if(data368 !== undefined){data368["insecure_settings"] = coerced211;}}}}if(data368.invalid_file_access !== undefined){let data370 = data368.invalid_file_access;if(typeof data370 !== "boolean"){let coerced212 = undefined;if(!(coerced212 !== undefined)){if(data370 === "false" || data370 === 0 || data370 === null){coerced212 = false;}else if(data370 === "true" || data370 === 1){coerced212 = true;}else {const err432 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/invalid_file_access",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/invalid_file_access/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err432];}else {vErrors.push(err432);}errors++;}}if(coerced212 !== undefined){data370 = coerced212;if(data368 !== undefined){data368["invalid_file_access"] = coerced212;}}}}if(data368.sql_injection !== undefined){let data371 = data368.sql_injection;if(typeof data371 !== "boolean"){let coerced213 = undefined;if(!(coerced213 !== undefined)){if(data371 === "false" || data371 === 0 || data371 === null){coerced213 = false;}else if(data371 === "true" || data371 === 1){coerced213 = true;}else {const err433 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/sql_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/sql_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err433];}else {vErrors.push(err433);}errors++;}}if(coerced213 !== undefined){data371 = coerced213;if(data368 !== undefined){data368["sql_injection"] = coerced213;}}}}if(data368.nosql_injection !== undefined){let data372 = data368.nosql_injection;if(typeof data372 !== "boolean"){let coerced214 = undefined;if(!(coerced214 !== undefined)){if(data372 === "false" || data372 === 0 || data372 === null){coerced214 = false;}else if(data372 === "true" || data372 === 1){coerced214 = true;}else {const err434 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/nosql_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/nosql_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err434];}else {vErrors.push(err434);}errors++;}}if(coerced214 !== undefined){data372 = coerced214;if(data368 !== undefined){data368["nosql_injection"] = coerced214;}}}}if(data368.ldap_injection !== undefined){let data373 = data368.ldap_injection;if(typeof data373 !== "boolean"){let coerced215 = undefined;if(!(coerced215 !== undefined)){if(data373 === "false" || data373 === 0 || data373 === null){coerced215 = false;}else if(data373 === "true" || data373 === 1){coerced215 = true;}else {const err435 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/ldap_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/ldap_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err435];}else {vErrors.push(err435);}errors++;}}if(coerced215 !== undefined){data373 = coerced215;if(data368 !== undefined){data368["ldap_injection"] = coerced215;}}}}if(data368.javascript_injection !== undefined){let data374 = data368.javascript_injection;if(typeof data374 !== "boolean"){let coerced216 = undefined;if(!(coerced216 !== undefined)){if(data374 === "false" || data374 === 0 || data374 === null){coerced216 = false;}else if(data374 === "true" || data374 === 1){coerced216 = true;}else {const err436 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/javascript_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/javascript_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err436];}else {vErrors.push(err436);}errors++;}}if(coerced216 !== undefined){data374 = coerced216;if(data368 !== undefined){data368["javascript_injection"] = coerced216;}}}}if(data368.command_injection !== undefined){let data375 = data368.command_injection;if(typeof data375 !== "boolean"){let coerced217 = undefined;if(!(coerced217 !== undefined)){if(data375 === "false" || data375 === 0 || data375 === null){coerced217 = false;}else if(data375 === "true" || data375 === 1){coerced217 = true;}else {const err437 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/command_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/command_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err437];}else {vErrors.push(err437);}errors++;}}if(coerced217 !== undefined){data375 = coerced217;if(data368 !== undefined){data368["command_injection"] = coerced217;}}}}if(data368.xpath_injection !== undefined){let data376 = data368.xpath_injection;if(typeof data376 !== "boolean"){let coerced218 = undefined;if(!(coerced218 !== undefined)){if(data376 === "false" || data376 === 0 || data376 === null){coerced218 = false;}else if(data376 === "true" || data376 === 1){coerced218 = true;}else {const err438 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/xpath_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/xpath_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err438];}else {vErrors.push(err438);}errors++;}}if(coerced218 !== undefined){data376 = coerced218;if(data368 !== undefined){data368["xpath_injection"] = coerced218;}}}}if(data368.ssrf !== undefined){let data377 = data368.ssrf;if(typeof data377 !== "boolean"){let coerced219 = undefined;if(!(coerced219 !== undefined)){if(data377 === "false" || data377 === 0 || data377 === null){coerced219 = false;}else if(data377 === "true" || data377 === 1){coerced219 = true;}else {const err439 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/ssrf",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/ssrf/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err439];}else {vErrors.push(err439);}errors++;}}if(coerced219 !== undefined){data377 = coerced219;if(data368 !== undefined){data368["ssrf"] = coerced219;}}}}if(data368.rxss !== undefined){let data378 = data368.rxss;if(typeof data378 !== "boolean"){let coerced220 = undefined;if(!(coerced220 !== undefined)){if(data378 === "false" || data378 === 0 || data378 === null){coerced220 = false;}else if(data378 === "true" || data378 === 1){coerced220 = true;}else {const err440 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/rxss",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/rxss/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err440];}else {vErrors.push(err440);}errors++;}}if(coerced220 !== undefined){data378 = coerced220;if(data368 !== undefined){data368["rxss"] = coerced220;}}}}}else {const err441 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err441];}else {vErrors.push(err441);}errors++;}}}else {const err442 = {instancePath:instancePath+"/security/exclude_from_iast_scan",schemaPath:"security.js/properties/exclude_from_iast_scan/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err442];}else {vErrors.push(err442);}errors++;}}}else {const err443 = {instancePath:instancePath+"/security",schemaPath:"security.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err443];}else {vErrors.push(err443);}errors++;}}if(data.serverless_mode !== undefined){let data379 = data.serverless_mode;if(data379 && typeof data379 == "object" && !Array.isArray(data379)){if(data379.enabled !== undefined){let data380 = data379.enabled;if(typeof data380 !== "boolean"){let coerced221 = undefined;if(!(coerced221 !== undefined)){if(data380 === "false" || data380 === 0 || data380 === null){coerced221 = false;}else if(data380 === "true" || data380 === 1){coerced221 = true;}else {const err444 = {instancePath:instancePath+"/serverless_mode/enabled",schemaPath:"serverless-mode.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err444];}else {vErrors.push(err444);}errors++;}}if(coerced221 !== undefined){data380 = coerced221;if(data379 !== undefined){data379["enabled"] = coerced221;}}}}}else {const err445 = {instancePath:instancePath+"/serverless_mode",schemaPath:"serverless-mode.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err445];}else {vErrors.push(err445);}errors++;}}if(data.slow_sql !== undefined){let data381 = data.slow_sql;if(data381 && typeof data381 == "object" && !Array.isArray(data381)){if(data381.enabled !== undefined){let data382 = data381.enabled;if(typeof data382 !== "boolean"){let coerced222 = undefined;if(!(coerced222 !== undefined)){if(data382 === "false" || data382 === 0 || data382 === null){coerced222 = false;}else if(data382 === "true" || data382 === 1){coerced222 = true;}else {const err446 = {instancePath:instancePath+"/slow_sql/enabled",schemaPath:"slow-sql.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err446];}else {vErrors.push(err446);}errors++;}}if(coerced222 !== undefined){data382 = coerced222;if(data381 !== undefined){data381["enabled"] = coerced222;}}}}if(data381.max_samples !== undefined){let data383 = data381.max_samples;if(!((typeof data383 == "number") && (!(data383 % 1) && !isNaN(data383)))){let dataType223 = typeof data383;let coerced223 = undefined;if(!(coerced223 !== undefined)){if(dataType223 === "boolean" || data383 === null
                  || (dataType223 === "string" && data383 && data383 == +data383 && !(data383 % 1))){coerced223 = +data383;}else {const err447 = {instancePath:instancePath+"/slow_sql/max_samples",schemaPath:"slow-sql.js/properties/max_samples/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err447];}else {vErrors.push(err447);}errors++;}}if(coerced223 !== undefined){data383 = coerced223;if(data381 !== undefined){data381["max_samples"] = coerced223;}}}}}else {const err448 = {instancePath:instancePath+"/slow_sql",schemaPath:"slow-sql.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err448];}else {vErrors.push(err448);}errors++;}}if(data.span_events !== undefined){let data384 = data.span_events;if(data384 && typeof data384 == "object" && !Array.isArray(data384)){if(data384.enabled !== undefined){let data385 = data384.enabled;if(typeof data385 !== "boolean"){let coerced224 = undefined;if(!(coerced224 !== undefined)){if(data385 === "false" || data385 === 0 || data385 === null){coerced224 = false;}else if(data385 === "true" || data385 === 1){coerced224 = true;}else {const err449 = {instancePath:instancePath+"/span_events/enabled",schemaPath:"span-events.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err449];}else {vErrors.push(err449);}errors++;}}if(coerced224 !== undefined){data385 = coerced224;if(data384 !== undefined){data384["enabled"] = coerced224;}}}}if(data384.attributes !== undefined){let data386 = data384.attributes;if(data386 && typeof data386 == "object" && !Array.isArray(data386)){if(data386.enabled !== undefined){let data387 = data386.enabled;if(typeof data387 !== "boolean"){let coerced225 = undefined;if(!(coerced225 !== undefined)){if(data387 === "false" || data387 === 0 || data387 === null){coerced225 = false;}else if(data387 === "true" || data387 === 1){coerced225 = true;}else {const err450 = {instancePath:instancePath+"/span_events/attributes/enabled",schemaPath:"span-events.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err450];}else {vErrors.push(err450);}errors++;}}if(coerced225 !== undefined){data387 = coerced225;if(data386 !== undefined){data386["enabled"] = coerced225;}}}}if(data386.exclude !== undefined){let data388 = data386.exclude;if(Array.isArray(data388)){const len21 = data388.length;for(let i21=0; i21<len21; i21++){let data389 = data388[i21];if(typeof data389 !== "string"){let dataType226 = typeof data389;let coerced226 = undefined;if(!(coerced226 !== undefined)){if(dataType226 == "number" || dataType226 == "boolean"){coerced226 = "" + data389;}else if(data389 === null){coerced226 = "";}else {const err451 = {instancePath:instancePath+"/span_events/attributes/exclude/" + i21,schemaPath:"span-events.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err451];}else {vErrors.push(err451);}errors++;}}if(coerced226 !== undefined){data389 = coerced226;if(data388 !== undefined){data388[i21] = coerced226;}}}}}else {const err452 = {instancePath:instancePath+"/span_events/attributes/exclude",schemaPath:"span-events.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err452];}else {vErrors.push(err452);}errors++;}}if(data386.include !== undefined){let data390 = data386.include;if(Array.isArray(data390)){const len22 = data390.length;for(let i22=0; i22<len22; i22++){let data391 = data390[i22];if(typeof data391 !== "string"){let dataType227 = typeof data391;let coerced227 = undefined;if(!(coerced227 !== undefined)){if(dataType227 == "number" || dataType227 == "boolean"){coerced227 = "" + data391;}else if(data391 === null){coerced227 = "";}else {const err453 = {instancePath:instancePath+"/span_events/attributes/include/" + i22,schemaPath:"span-events.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err453];}else {vErrors.push(err453);}errors++;}}if(coerced227 !== undefined){data391 = coerced227;if(data390 !== undefined){data390[i22] = coerced227;}}}}}else {const err454 = {instancePath:instancePath+"/span_events/attributes/include",schemaPath:"span-events.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err454];}else {vErrors.push(err454);}errors++;}}}else {const err455 = {instancePath:instancePath+"/span_events/attributes",schemaPath:"span-events.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err455];}else {vErrors.push(err455);}errors++;}}if(data384.max_samples_stored !== undefined){let data392 = data384.max_samples_stored;if(!((typeof data392 == "number") && (!(data392 % 1) && !isNaN(data392)))){let dataType228 = typeof data392;let coerced228 = undefined;if(!(coerced228 !== undefined)){if(dataType228 === "boolean" || data392 === null
                  || (dataType228 === "string" && data392 && data392 == +data392 && !(data392 % 1))){coerced228 = +data392;}else {const err456 = {instancePath:instancePath+"/span_events/max_samples_stored",schemaPath:"span-events.js/properties/max_samples_stored/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err456];}else {vErrors.push(err456);}errors++;}}if(coerced228 !== undefined){data392 = coerced228;if(data384 !== undefined){data384["max_samples_stored"] = coerced228;}}}}}else {const err457 = {instancePath:instancePath+"/span_events",schemaPath:"span-events.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err457];}else {vErrors.push(err457);}errors++;}}if(data.strip_exception_messages !== undefined){let data393 = data.strip_exception_messages;if(data393 && typeof data393 == "object" && !Array.isArray(data393)){if(data393.enabled !== undefined){let data394 = data393.enabled;if(typeof data394 !== "boolean"){let coerced229 = undefined;if(!(coerced229 !== undefined)){if(data394 === "false" || data394 === 0 || data394 === null){coerced229 = false;}else if(data394 === "true" || data394 === 1){coerced229 = true;}else {const err458 = {instancePath:instancePath+"/strip_exception_messages/enabled",schemaPath:"strip-exception-messages.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err458];}else {vErrors.push(err458);}errors++;}}if(coerced229 !== undefined){data394 = coerced229;if(data393 !== undefined){data393["enabled"] = coerced229;}}}}}else {const err459 = {instancePath:instancePath+"/strip_exception_messages",schemaPath:"strip-exception-messages.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err459];}else {vErrors.push(err459);}errors++;}}if(data.transaction_events !== undefined){let data395 = data.transaction_events;if(data395 && typeof data395 == "object" && !Array.isArray(data395)){if(data395.attributes !== undefined){let data396 = data395.attributes;if(data396 && typeof data396 == "object" && !Array.isArray(data396)){if(data396.enabled !== undefined){let data397 = data396.enabled;if(typeof data397 !== "boolean"){let coerced230 = undefined;if(!(coerced230 !== undefined)){if(data397 === "false" || data397 === 0 || data397 === null){coerced230 = false;}else if(data397 === "true" || data397 === 1){coerced230 = true;}else {const err460 = {instancePath:instancePath+"/transaction_events/attributes/enabled",schemaPath:"transaction-events.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err460];}else {vErrors.push(err460);}errors++;}}if(coerced230 !== undefined){data397 = coerced230;if(data396 !== undefined){data396["enabled"] = coerced230;}}}}if(data396.exclude !== undefined){let data398 = data396.exclude;if(Array.isArray(data398)){const len23 = data398.length;for(let i23=0; i23<len23; i23++){let data399 = data398[i23];if(typeof data399 !== "string"){let dataType231 = typeof data399;let coerced231 = undefined;if(!(coerced231 !== undefined)){if(dataType231 == "number" || dataType231 == "boolean"){coerced231 = "" + data399;}else if(data399 === null){coerced231 = "";}else {const err461 = {instancePath:instancePath+"/transaction_events/attributes/exclude/" + i23,schemaPath:"transaction-events.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err461];}else {vErrors.push(err461);}errors++;}}if(coerced231 !== undefined){data399 = coerced231;if(data398 !== undefined){data398[i23] = coerced231;}}}}}else {const err462 = {instancePath:instancePath+"/transaction_events/attributes/exclude",schemaPath:"transaction-events.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err462];}else {vErrors.push(err462);}errors++;}}if(data396.include !== undefined){let data400 = data396.include;if(Array.isArray(data400)){const len24 = data400.length;for(let i24=0; i24<len24; i24++){let data401 = data400[i24];if(typeof data401 !== "string"){let dataType232 = typeof data401;let coerced232 = undefined;if(!(coerced232 !== undefined)){if(dataType232 == "number" || dataType232 == "boolean"){coerced232 = "" + data401;}else if(data401 === null){coerced232 = "";}else {const err463 = {instancePath:instancePath+"/transaction_events/attributes/include/" + i24,schemaPath:"transaction-events.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err463];}else {vErrors.push(err463);}errors++;}}if(coerced232 !== undefined){data401 = coerced232;if(data400 !== undefined){data400[i24] = coerced232;}}}}}else {const err464 = {instancePath:instancePath+"/transaction_events/attributes/include",schemaPath:"transaction-events.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err464];}else {vErrors.push(err464);}errors++;}}}else {const err465 = {instancePath:instancePath+"/transaction_events/attributes",schemaPath:"transaction-events.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err465];}else {vErrors.push(err465);}errors++;}}if(data395.enabled !== undefined){let data402 = data395.enabled;if(typeof data402 !== "boolean"){let coerced233 = undefined;if(!(coerced233 !== undefined)){if(data402 === "false" || data402 === 0 || data402 === null){coerced233 = false;}else if(data402 === "true" || data402 === 1){coerced233 = true;}else {const err466 = {instancePath:instancePath+"/transaction_events/enabled",schemaPath:"transaction-events.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err466];}else {vErrors.push(err466);}errors++;}}if(coerced233 !== undefined){data402 = coerced233;if(data395 !== undefined){data395["enabled"] = coerced233;}}}}if(data395.max_samples_stored !== undefined){let data403 = data395.max_samples_stored;if(!((typeof data403 == "number") && (!(data403 % 1) && !isNaN(data403)))){let dataType234 = typeof data403;let coerced234 = undefined;if(!(coerced234 !== undefined)){if(dataType234 === "boolean" || data403 === null
                  || (dataType234 === "string" && data403 && data403 == +data403 && !(data403 % 1))){coerced234 = +data403;}else {const err467 = {instancePath:instancePath+"/transaction_events/max_samples_stored",schemaPath:"transaction-events.js/properties/max_samples_stored/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err467];}else {vErrors.push(err467);}errors++;}}if(coerced234 !== undefined){data403 = coerced234;if(data395 !== undefined){data395["max_samples_stored"] = coerced234;}}}}}else {const err468 = {instancePath:instancePath+"/transaction_events",schemaPath:"transaction-events.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err468];}else {vErrors.push(err468);}errors++;}}if(data.transaction_segments !== undefined){let data404 = data.transaction_segments;if(data404 && typeof data404 == "object" && !Array.isArray(data404)){if(data404.attributes !== undefined){let data405 = data404.attributes;if(data405 && typeof data405 == "object" && !Array.isArray(data405)){if(data405.enabled !== undefined){let data406 = data405.enabled;if(typeof data406 !== "boolean"){let coerced235 = undefined;if(!(coerced235 !== undefined)){if(data406 === "false" || data406 === 0 || data406 === null){coerced235 = false;}else if(data406 === "true" || data406 === 1){coerced235 = true;}else {const err469 = {instancePath:instancePath+"/transaction_segments/attributes/enabled",schemaPath:"transaction-segments.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err469];}else {vErrors.push(err469);}errors++;}}if(coerced235 !== undefined){data406 = coerced235;if(data405 !== undefined){data405["enabled"] = coerced235;}}}}if(data405.exclude !== undefined){let data407 = data405.exclude;if(Array.isArray(data407)){const len25 = data407.length;for(let i25=0; i25<len25; i25++){let data408 = data407[i25];if(typeof data408 !== "string"){let dataType236 = typeof data408;let coerced236 = undefined;if(!(coerced236 !== undefined)){if(dataType236 == "number" || dataType236 == "boolean"){coerced236 = "" + data408;}else if(data408 === null){coerced236 = "";}else {const err470 = {instancePath:instancePath+"/transaction_segments/attributes/exclude/" + i25,schemaPath:"transaction-segments.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err470];}else {vErrors.push(err470);}errors++;}}if(coerced236 !== undefined){data408 = coerced236;if(data407 !== undefined){data407[i25] = coerced236;}}}}}else {const err471 = {instancePath:instancePath+"/transaction_segments/attributes/exclude",schemaPath:"transaction-segments.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err471];}else {vErrors.push(err471);}errors++;}}if(data405.include !== undefined){let data409 = data405.include;if(Array.isArray(data409)){const len26 = data409.length;for(let i26=0; i26<len26; i26++){let data410 = data409[i26];if(typeof data410 !== "string"){let dataType237 = typeof data410;let coerced237 = undefined;if(!(coerced237 !== undefined)){if(dataType237 == "number" || dataType237 == "boolean"){coerced237 = "" + data410;}else if(data410 === null){coerced237 = "";}else {const err472 = {instancePath:instancePath+"/transaction_segments/attributes/include/" + i26,schemaPath:"transaction-segments.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err472];}else {vErrors.push(err472);}errors++;}}if(coerced237 !== undefined){data410 = coerced237;if(data409 !== undefined){data409[i26] = coerced237;}}}}}else {const err473 = {instancePath:instancePath+"/transaction_segments/attributes/include",schemaPath:"transaction-segments.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err473];}else {vErrors.push(err473);}errors++;}}}else {const err474 = {instancePath:instancePath+"/transaction_segments/attributes",schemaPath:"transaction-segments.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err474];}else {vErrors.push(err474);}errors++;}}}else {const err475 = {instancePath:instancePath+"/transaction_segments",schemaPath:"transaction-segments.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err475];}else {vErrors.push(err475);}errors++;}}if(data.transaction_tracer !== undefined){let data411 = data.transaction_tracer;if(data411 && typeof data411 == "object" && !Array.isArray(data411)){if(data411.attributes !== undefined){let data412 = data411.attributes;if(data412 && typeof data412 == "object" && !Array.isArray(data412)){if(data412.enabled !== undefined){let data413 = data412.enabled;if(typeof data413 !== "boolean"){let coerced238 = undefined;if(!(coerced238 !== undefined)){if(data413 === "false" || data413 === 0 || data413 === null){coerced238 = false;}else if(data413 === "true" || data413 === 1){coerced238 = true;}else {const err476 = {instancePath:instancePath+"/transaction_tracer/attributes/enabled",schemaPath:"transaction-tracer.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err476];}else {vErrors.push(err476);}errors++;}}if(coerced238 !== undefined){data413 = coerced238;if(data412 !== undefined){data412["enabled"] = coerced238;}}}}if(data412.exclude !== undefined){let data414 = data412.exclude;if(Array.isArray(data414)){const len27 = data414.length;for(let i27=0; i27<len27; i27++){let data415 = data414[i27];if(typeof data415 !== "string"){let dataType239 = typeof data415;let coerced239 = undefined;if(!(coerced239 !== undefined)){if(dataType239 == "number" || dataType239 == "boolean"){coerced239 = "" + data415;}else if(data415 === null){coerced239 = "";}else {const err477 = {instancePath:instancePath+"/transaction_tracer/attributes/exclude/" + i27,schemaPath:"transaction-tracer.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err477];}else {vErrors.push(err477);}errors++;}}if(coerced239 !== undefined){data415 = coerced239;if(data414 !== undefined){data414[i27] = coerced239;}}}}}else {const err478 = {instancePath:instancePath+"/transaction_tracer/attributes/exclude",schemaPath:"transaction-tracer.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err478];}else {vErrors.push(err478);}errors++;}}if(data412.include !== undefined){let data416 = data412.include;if(Array.isArray(data416)){const len28 = data416.length;for(let i28=0; i28<len28; i28++){let data417 = data416[i28];if(typeof data417 !== "string"){let dataType240 = typeof data417;let coerced240 = undefined;if(!(coerced240 !== undefined)){if(dataType240 == "number" || dataType240 == "boolean"){coerced240 = "" + data417;}else if(data417 === null){coerced240 = "";}else {const err479 = {instancePath:instancePath+"/transaction_tracer/attributes/include/" + i28,schemaPath:"transaction-tracer.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err479];}else {vErrors.push(err479);}errors++;}}if(coerced240 !== undefined){data417 = coerced240;if(data416 !== undefined){data416[i28] = coerced240;}}}}}else {const err480 = {instancePath:instancePath+"/transaction_tracer/attributes/include",schemaPath:"transaction-tracer.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err480];}else {vErrors.push(err480);}errors++;}}}else {const err481 = {instancePath:instancePath+"/transaction_tracer/attributes",schemaPath:"transaction-tracer.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err481];}else {vErrors.push(err481);}errors++;}}if(data411.enabled !== undefined){let data418 = data411.enabled;if(typeof data418 !== "boolean"){let coerced241 = undefined;if(!(coerced241 !== undefined)){if(data418 === "false" || data418 === 0 || data418 === null){coerced241 = false;}else if(data418 === "true" || data418 === 1){coerced241 = true;}else {const err482 = {instancePath:instancePath+"/transaction_tracer/enabled",schemaPath:"transaction-tracer.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err482];}else {vErrors.push(err482);}errors++;}}if(coerced241 !== undefined){data418 = coerced241;if(data411 !== undefined){data411["enabled"] = coerced241;}}}}if(data411.transaction_threshold !== undefined){let data419 = data411.transaction_threshold;if((!(typeof data419 == "number")) && (typeof data419 !== "string")){let dataType242 = typeof data419;let coerced242 = undefined;if(!(coerced242 !== undefined)){if(dataType242 == "boolean" || data419 === null
                  || (dataType242 == "string" && data419 && data419 == +data419)){coerced242 = +data419;}else if(dataType242 == "number" || dataType242 == "boolean"){coerced242 = "" + data419;}else if(data419 === null){coerced242 = "";}else {const err483 = {instancePath:instancePath+"/transaction_tracer/transaction_threshold",schemaPath:"transaction-tracer.js/properties/transaction_threshold/type",keyword:"type",params:{type: schema65.properties.transaction_threshold.type},message:"must be number,string"};if(vErrors === null){vErrors = [err483];}else {vErrors.push(err483);}errors++;}}if(coerced242 !== undefined){data419 = coerced242;if(data411 !== undefined){data411["transaction_threshold"] = coerced242;}}}}if(data411.top_n !== undefined){let data420 = data411.top_n;if(!((typeof data420 == "number") && (!(data420 % 1) && !isNaN(data420)))){let dataType243 = typeof data420;let coerced243 = undefined;if(!(coerced243 !== undefined)){if(dataType243 === "boolean" || data420 === null
                  || (dataType243 === "string" && data420 && data420 == +data420 && !(data420 % 1))){coerced243 = +data420;}else {const err484 = {instancePath:instancePath+"/transaction_tracer/top_n",schemaPath:"transaction-tracer.js/properties/top_n/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err484];}else {vErrors.push(err484);}errors++;}}if(coerced243 !== undefined){data420 = coerced243;if(data411 !== undefined){data411["top_n"] = coerced243;}}}}if(data411.record_sql !== undefined){let data421 = data411.record_sql;if(typeof data421 !== "string"){let dataType244 = typeof data421;let coerced244 = undefined;if(!(coerced244 !== undefined)){if(dataType244 == "number" || dataType244 == "boolean"){coerced244 = "" + data421;}else if(data421 === null){coerced244 = "";}else {const err485 = {instancePath:instancePath+"/transaction_tracer/record_sql",schemaPath:"transaction-tracer.js/properties/record_sql/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err485];}else {vErrors.push(err485);}errors++;}}if(coerced244 !== undefined){data421 = coerced244;if(data411 !== undefined){data411["record_sql"] = coerced244;}}}if(!(((data421 === "off") || (data421 === "obfuscated")) || (data421 === "raw"))){const err486 = {instancePath:instancePath+"/transaction_tracer/record_sql",schemaPath:"transaction-tracer.js/properties/record_sql/enum",keyword:"enum",params:{allowedValues: schema65.properties.record_sql.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err486];}else {vErrors.push(err486);}errors++;}}if(data411.explain_threshold !== undefined){let data422 = data411.explain_threshold;if(!((typeof data422 == "number") && (!(data422 % 1) && !isNaN(data422)))){let dataType245 = typeof data422;let coerced245 = undefined;if(!(coerced245 !== undefined)){if(dataType245 === "boolean" || data422 === null
                  || (dataType245 === "string" && data422 && data422 == +data422 && !(data422 % 1))){coerced245 = +data422;}else {const err487 = {instancePath:instancePath+"/transaction_tracer/explain_threshold",schemaPath:"transaction-tracer.js/properties/explain_threshold/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err487];}else {vErrors.push(err487);}errors++;}}if(coerced245 !== undefined){data422 = coerced245;if(data411 !== undefined){data411["explain_threshold"] = coerced245;}}}}}else {const err488 = {instancePath:instancePath+"/transaction_tracer",schemaPath:"transaction-tracer.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err488];}else {vErrors.push(err488);}errors++;}}if(data.url_obfuscation !== undefined){let data423 = data.url_obfuscation;if(data423 && typeof data423 == "object" && !Array.isArray(data423)){if(data423.enabled !== undefined){let data424 = data423.enabled;if(typeof data424 !== "boolean"){let coerced246 = undefined;if(!(coerced246 !== undefined)){if(data424 === "false" || data424 === 0 || data424 === null){coerced246 = false;}else if(data424 === "true" || data424 === 1){coerced246 = true;}else {const err489 = {instancePath:instancePath+"/url_obfuscation/enabled",schemaPath:"url-obfuscation.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err489];}else {vErrors.push(err489);}errors++;}}if(coerced246 !== undefined){data424 = coerced246;if(data423 !== undefined){data423["enabled"] = coerced246;}}}}if(data423.regex !== undefined){let data425 = data423.regex;if(data425 && typeof data425 == "object" && !Array.isArray(data425)){if(data425.pattern !== undefined){let data426 = data425.pattern;if(typeof data426 !== "string"){let dataType247 = typeof data426;let coerced247 = undefined;if(!(coerced247 !== undefined)){if(dataType247 == "number" || dataType247 == "boolean"){coerced247 = "" + data426;}else if(data426 === null){coerced247 = "";}else {const err490 = {instancePath:instancePath+"/url_obfuscation/regex/pattern",schemaPath:"url-obfuscation.js/properties/regex/properties/pattern/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err490];}else {vErrors.push(err490);}errors++;}}if(coerced247 !== undefined){data426 = coerced247;if(data425 !== undefined){data425["pattern"] = coerced247;}}}}if(data425.flags !== undefined){let data427 = data425.flags;if(typeof data427 !== "string"){let dataType248 = typeof data427;let coerced248 = undefined;if(!(coerced248 !== undefined)){if(dataType248 == "number" || dataType248 == "boolean"){coerced248 = "" + data427;}else if(data427 === null){coerced248 = "";}else {const err491 = {instancePath:instancePath+"/url_obfuscation/regex/flags",schemaPath:"url-obfuscation.js/properties/regex/properties/flags/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err491];}else {vErrors.push(err491);}errors++;}}if(coerced248 !== undefined){data427 = coerced248;if(data425 !== undefined){data425["flags"] = coerced248;}}}}if(data425.replacement !== undefined){let data428 = data425.replacement;if(typeof data428 !== "string"){let dataType249 = typeof data428;let coerced249 = undefined;if(!(coerced249 !== undefined)){if(dataType249 == "number" || dataType249 == "boolean"){coerced249 = "" + data428;}else if(data428 === null){coerced249 = "";}else {const err492 = {instancePath:instancePath+"/url_obfuscation/regex/replacement",schemaPath:"url-obfuscation.js/properties/regex/properties/replacement/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err492];}else {vErrors.push(err492);}errors++;}}if(coerced249 !== undefined){data428 = coerced249;if(data425 !== undefined){data425["replacement"] = coerced249;}}}}}else {const err493 = {instancePath:instancePath+"/url_obfuscation/regex",schemaPath:"url-obfuscation.js/properties/regex/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err493];}else {vErrors.push(err493);}errors++;}}}else {const err494 = {instancePath:instancePath+"/url_obfuscation",schemaPath:"url-obfuscation.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err494];}else {vErrors.push(err494);}errors++;}}if(data.utilization !== undefined){let data429 = data.utilization;if(data429 && typeof data429 == "object" && !Array.isArray(data429)){if(data429.detect_aws !== undefined){let data430 = data429.detect_aws;if(typeof data430 !== "boolean"){let coerced250 = undefined;if(!(coerced250 !== undefined)){if(data430 === "false" || data430 === 0 || data430 === null){coerced250 = false;}else if(data430 === "true" || data430 === 1){coerced250 = true;}else {const err495 = {instancePath:instancePath+"/utilization/detect_aws",schemaPath:"utilization.js/properties/detect_aws/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err495];}else {vErrors.push(err495);}errors++;}}if(coerced250 !== undefined){data430 = coerced250;if(data429 !== undefined){data429["detect_aws"] = coerced250;}}}}if(data429.detect_pcf !== undefined){let data431 = data429.detect_pcf;if(typeof data431 !== "boolean"){let coerced251 = undefined;if(!(coerced251 !== undefined)){if(data431 === "false" || data431 === 0 || data431 === null){coerced251 = false;}else if(data431 === "true" || data431 === 1){coerced251 = true;}else {const err496 = {instancePath:instancePath+"/utilization/detect_pcf",schemaPath:"utilization.js/properties/detect_pcf/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err496];}else {vErrors.push(err496);}errors++;}}if(coerced251 !== undefined){data431 = coerced251;if(data429 !== undefined){data429["detect_pcf"] = coerced251;}}}}if(data429.detect_azure !== undefined){let data432 = data429.detect_azure;if(typeof data432 !== "boolean"){let coerced252 = undefined;if(!(coerced252 !== undefined)){if(data432 === "false" || data432 === 0 || data432 === null){coerced252 = false;}else if(data432 === "true" || data432 === 1){coerced252 = true;}else {const err497 = {instancePath:instancePath+"/utilization/detect_azure",schemaPath:"utilization.js/properties/detect_azure/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err497];}else {vErrors.push(err497);}errors++;}}if(coerced252 !== undefined){data432 = coerced252;if(data429 !== undefined){data429["detect_azure"] = coerced252;}}}}if(data429.detect_azurefunction !== undefined){let data433 = data429.detect_azurefunction;if(typeof data433 !== "boolean"){let coerced253 = undefined;if(!(coerced253 !== undefined)){if(data433 === "false" || data433 === 0 || data433 === null){coerced253 = false;}else if(data433 === "true" || data433 === 1){coerced253 = true;}else {const err498 = {instancePath:instancePath+"/utilization/detect_azurefunction",schemaPath:"utilization.js/properties/detect_azurefunction/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err498];}else {vErrors.push(err498);}errors++;}}if(coerced253 !== undefined){data433 = coerced253;if(data429 !== undefined){data429["detect_azurefunction"] = coerced253;}}}}if(data429.detect_docker !== undefined){let data434 = data429.detect_docker;if(typeof data434 !== "boolean"){let coerced254 = undefined;if(!(coerced254 !== undefined)){if(data434 === "false" || data434 === 0 || data434 === null){coerced254 = false;}else if(data434 === "true" || data434 === 1){coerced254 = true;}else {const err499 = {instancePath:instancePath+"/utilization/detect_docker",schemaPath:"utilization.js/properties/detect_docker/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err499];}else {vErrors.push(err499);}errors++;}}if(coerced254 !== undefined){data434 = coerced254;if(data429 !== undefined){data429["detect_docker"] = coerced254;}}}}if(data429.detect_gcp !== undefined){let data435 = data429.detect_gcp;if(typeof data435 !== "boolean"){let coerced255 = undefined;if(!(coerced255 !== undefined)){if(data435 === "false" || data435 === 0 || data435 === null){coerced255 = false;}else if(data435 === "true" || data435 === 1){coerced255 = true;}else {const err500 = {instancePath:instancePath+"/utilization/detect_gcp",schemaPath:"utilization.js/properties/detect_gcp/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err500];}else {vErrors.push(err500);}errors++;}}if(coerced255 !== undefined){data435 = coerced255;if(data429 !== undefined){data429["detect_gcp"] = coerced255;}}}}if(data429.detect_kubernetes !== undefined){let data436 = data429.detect_kubernetes;if(typeof data436 !== "boolean"){let coerced256 = undefined;if(!(coerced256 !== undefined)){if(data436 === "false" || data436 === 0 || data436 === null){coerced256 = false;}else if(data436 === "true" || data436 === 1){coerced256 = true;}else {const err501 = {instancePath:instancePath+"/utilization/detect_kubernetes",schemaPath:"utilization.js/properties/detect_kubernetes/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err501];}else {vErrors.push(err501);}errors++;}}if(coerced256 !== undefined){data436 = coerced256;if(data429 !== undefined){data429["detect_kubernetes"] = coerced256;}}}}if(data429.logical_processors !== undefined){let data437 = data429.logical_processors;if(!(typeof data437 == "number")){let dataType257 = typeof data437;let coerced257 = undefined;if(!(coerced257 !== undefined)){if(dataType257 == "boolean" || data437 === null
                  || (dataType257 == "string" && data437 && data437 == +data437)){coerced257 = +data437;}else {const err502 = {instancePath:instancePath+"/utilization/logical_processors",schemaPath:"utilization.js/properties/logical_processors/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err502];}else {vErrors.push(err502);}errors++;}}if(coerced257 !== undefined){data437 = coerced257;if(data429 !== undefined){data429["logical_processors"] = coerced257;}}}}if(data429.billing_hostname !== undefined){let data438 = data429.billing_hostname;if((typeof data438 !== "string") && (data438 !== null)){let dataType258 = typeof data438;let coerced258 = undefined;if(!(coerced258 !== undefined)){if(dataType258 == "number" || dataType258 == "boolean"){coerced258 = "" + data438;}else if(data438 === null){coerced258 = "";}else if(data438 === "" || data438 === 0 || data438 === false){coerced258 = null;}else {const err503 = {instancePath:instancePath+"/utilization/billing_hostname",schemaPath:"utilization.js/properties/billing_hostname/type",keyword:"type",params:{type: schema67.properties.billing_hostname.type},message:"must be string,null"};if(vErrors === null){vErrors = [err503];}else {vErrors.push(err503);}errors++;}}if(coerced258 !== undefined){data438 = coerced258;if(data429 !== undefined){data429["billing_hostname"] = coerced258;}}}}if(data429.total_ram_mib !== undefined){let data439 = data429.total_ram_mib;if(!((typeof data439 == "number") && (!(data439 % 1) && !isNaN(data439)))){let dataType259 = typeof data439;let coerced259 = undefined;if(!(coerced259 !== undefined)){if(dataType259 === "boolean" || data439 === null
                  || (dataType259 === "string" && data439 && data439 == +data439 && !(data439 % 1))){coerced259 = +data439;}else {const err504 = {instancePath:instancePath+"/utilization/total_ram_mib",schemaPath:"utilization.js/properties/total_ram_mib/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err504];}else {vErrors.push(err504);}errors++;}}if(coerced259 !== undefined){data439 = coerced259;if(data429 !== undefined){data429["total_ram_mib"] = coerced259;}}}}if(data429.gcp_use_instance_as_host !== undefined){let data440 = data429.gcp_use_instance_as_host;if(typeof data440 !== "boolean"){let coerced260 = undefined;if(!(coerced260 !== undefined)){if(data440 === "false" || data440 === 0 || data440 === null){coerced260 = false;}else if(data440 === "true" || data440 === 1){coerced260 = true;}else {const err505 = {instancePath:instancePath+"/utilization/gcp_use_instance_as_host",schemaPath:"utilization.js/properties/gcp_use_instance_as_host/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err505];}else {vErrors.push(err505);}errors++;}}if(coerced260 !== undefined){data440 = coerced260;if(data429 !== undefined){data429["gcp_use_instance_as_host"] = coerced260;}}}}if(data429.gcp_cloud_run !== undefined){let data441 = data429.gcp_cloud_run;if(data441 && typeof data441 == "object" && !Array.isArray(data441)){if(data441.include_revision_in_host !== undefined){let data442 = data441.include_revision_in_host;if(typeof data442 !== "boolean"){let coerced261 = undefined;if(!(coerced261 !== undefined)){if(data442 === "false" || data442 === 0 || data442 === null){coerced261 = false;}else if(data442 === "true" || data442 === 1){coerced261 = true;}else {const err506 = {instancePath:instancePath+"/utilization/gcp_cloud_run/include_revision_in_host",schemaPath:"utilization.js/properties/gcp_cloud_run/properties/include_revision_in_host/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err506];}else {vErrors.push(err506);}errors++;}}if(coerced261 !== undefined){data442 = coerced261;if(data441 !== undefined){data441["include_revision_in_host"] = coerced261;}}}}if(data441.use_instance_as_host !== undefined){let data443 = data441.use_instance_as_host;if(typeof data443 !== "boolean"){let coerced262 = undefined;if(!(coerced262 !== undefined)){if(data443 === "false" || data443 === 0 || data443 === null){coerced262 = false;}else if(data443 === "true" || data443 === 1){coerced262 = true;}else {const err507 = {instancePath:instancePath+"/utilization/gcp_cloud_run/use_instance_as_host",schemaPath:"utilization.js/properties/gcp_cloud_run/properties/use_instance_as_host/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err507];}else {vErrors.push(err507);}errors++;}}if(coerced262 !== undefined){data443 = coerced262;if(data441 !== undefined){data441["use_instance_as_host"] = coerced262;}}}}}else {const err508 = {instancePath:instancePath+"/utilization/gcp_cloud_run",schemaPath:"utilization.js/properties/gcp_cloud_run/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err508];}else {vErrors.push(err508);}errors++;}}}else {const err509 = {instancePath:instancePath+"/utilization",schemaPath:"utilization.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err509];}else {vErrors.push(err509);}errors++;}}if(data.worker_threads !== undefined){let data444 = data.worker_threads;if(data444 && typeof data444 == "object" && !Array.isArray(data444)){if(data444.enabled !== undefined){let data445 = data444.enabled;if(typeof data445 !== "boolean"){let coerced263 = undefined;if(!(coerced263 !== undefined)){if(data445 === "false" || data445 === 0 || data445 === null){coerced263 = false;}else if(data445 === "true" || data445 === 1){coerced263 = true;}else {const err510 = {instancePath:instancePath+"/worker_threads/enabled",schemaPath:"worker-threads.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err510];}else {vErrors.push(err510);}errors++;}}if(coerced263 !== undefined){data445 = coerced263;if(data444 !== undefined){data444["enabled"] = coerced263;}}}}}else {const err511 = {instancePath:instancePath+"/worker_threads",schemaPath:"worker-threads.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err511];}else {vErrors.push(err511);}errors++;}}}else {const err512 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err512];}else {vErrors.push(err512);}errors++;}validate20.errors = vErrors;return errors === 0;}validate20.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

  })(module, exports, require)
  return module.exports
})()

const renderedSchema = require('./schema.json')

module.exports = { schema, validate, refs, renderedSchema, envVarIndex }