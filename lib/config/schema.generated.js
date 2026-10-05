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
 */
const { schema, refs, renderedSchema, envVarIndex } = 
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
        "timers": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": false,
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
  "renderedSchema": {
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
      "ai_monitoring": {
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
      "api": {
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
      "apollo_server": {
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
          }
        },
        "additionalProperties": true,
        "description": "Stanza for customizing behavior for apollo server instrumentation"
      },
      "application_logging": {
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
      "attributes": {
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
      "audit_log": {
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
      "browser_monitoring": {
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
      "cloud": {
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
      "code_level_metrics": {
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
      "custom_insights_events": {
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
      "datastore_tracer": {
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
      "distributed_tracing": {
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
      "error_collector": {
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
      "grpc": {
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
      "heroku": {
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
      "infinite_tracing": {
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
      "instrumentation": {
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
          "timers": {
            "type": "object",
            "additionalProperties": true,
            "properties": {
              "enabled": {
                "type": "boolean",
                "default": false,
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
      "kafka": {
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
      "logging": {
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
      "message_tracer": {
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
      "opentelemetry": {
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
      "plugins": {
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
      "process_host": {
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
      "profiling": {
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
          }
        },
        "additionalProperties": true,
        "description": "Controls the behavior of the profiler."
      },
      "rules": {
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
      "security": {
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
      "serverless_mode": {
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
      "slow_sql": {
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
      "span_events": {
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
      "strip_exception_messages": {
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
      "transaction_events": {
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
      "transaction_segments": {
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
      "transaction_tracer": {
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
      "url_obfuscation": {
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
      "utilization": {
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
      "worker_threads": {
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
    "NEW_RELIC_INSTRUMENTATION_TIMERS_ENABLED": {
      "pathSegments": [
        "instrumentation",
        "timers",
        "enabled"
      ],
      "node": {
        "type": "boolean",
        "default": false,
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
    "use strict";module.exports = validate20;module.exports.default = validate20;const schema31 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"root.js","title":"New Relic Node.js Agent Configuration","description":"Configuration accepted by the New Relic Node.js agent's config file (newrelic.js, newrelic.cjs, or newrelic.mjs), and by the equivalent NEW_RELIC_* environment variables.","type":"object","required":[],"additionalProperties":true,"properties":{"account_id":{"type":["string","number","null"],"default":null,"description":"The New Relic account ID to attribute serverless trace data to. Only used in serverless_mode; required for distributed tracing to be enabled there. Locally configured values are ignored outside serverless_mode."},"agent_enabled":{"x-newrelic-env-var":"NEW_RELIC_ENABLED","type":"boolean","default":true,"description":"Whether the module is enabled."},"allow_all_headers":{"type":"boolean","default":false,"description":"When true, all request headers except for those listed in attributes.exclude will be captured for all traces, unless otherwise specified in a destination's attributes include/exclude lists."},"apdex_t":{"type":"number","default":0.1,"description":"The default Apdex tolerating / threshold value for applications, in seconds. The default for Node is apdexT to 100 milliseconds, which is lower than New Relic standard, but Node.js applications tend to be more latency-sensitive than most. NOTE: This setting can not be modified locally. Use server-side configuration to change your application's apdex."},"apm_lambda_mode":{"type":"boolean","default":false,"description":"When `true`, the AWS Lambda instrumentation will add the necessary data to support the new (as of 2025) unified APM UI."},"app_name":{"oneOf":[{"type":"array","items":{"type":"string"}},{"type":"string"}],"default":[],"description":"Array of application names."},"certificates":{"type":"array","items":{"type":"string"},"default":[],"description":"Custom SSL certificates If your proxy uses a custom SSL certificate, you can add the CA text to this array, one entry per certificate. The easiest way to do this is with `fs.readFileSync` e.g. certificates: [ require('fs').readFileSync('custom.crt', 'utf8') // don't forget the utf8 ]"},"compressed_content_encoding":{"type":"string","default":"gzip","description":"If the data compression threshold is reached in the payload, the agent compresses data, using gzip compression by default. The config option `compressed_content_encoding` can be set to 'deflate' to use deflate compression."},"enforce_backstop":{"type":"boolean","default":true,"description":"By default, any transactions that are not affected by other bits of naming logic (the API, rules, or metric normalization rules) will have their names set to 'NormalizedUri/*'. Setting this value to false will set them instead to Uri/path/to/resource. Don't change this setting unless you understand the implications of New Relic's metric grouping issues and are confident your application isn't going to run afoul of them. Your application could end up getting blocked! Nobody wants that."},"high_security":{"type":"boolean","default":false,"description":"High Security High security mode (v2) is a setting which prevents any sensitive data from being sent to New Relic. The local setting must match the server setting. If there is a mismatch the agent will log a message and act as if it is disabled. Attributes of high security mode (when enabled): requires SSL does not allow capturing of http params does not allow custom params To read more see: https://docs.newrelic.com/docs/subscriptions/high-security"},"host":{"type":"string","default":"","description":"Hostname for the New Relic collector proxy. You shouldn't need to change this."},"ignore_server_configuration":{"x-newrelic-env-var":"NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG","type":"boolean","default":false,"description":"You may want more control over how your agent is configured and want to disallow the use of New Relic's server-side configuration for agents. To do so, set this to true. env NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG"},"labels":{"oneOf":[{"type":"object"},{"type":"string"}],"default":{},"description":"Label names and values applied to the data sent from this agent, as an object or a `;`-delimited `key:value` string. Label names and values are truncated to 255 characters and the set is capped at 64."},"license_key":{"type":"string","default":"","description":"The user's license key. Must be set by per-app configuration file."},"newrelic_home":{"x-newrelic-env-var":"NEW_RELIC_HOME","type":["string","null"],"default":null},"port":{"type":"integer","default":443,"description":"The port on which the collector proxy will be listening. You shouldn't need to change this."},"primary_application_id":{"type":["string","number","null"],"default":null,"description":"The APM application ID to attribute serverless trace data to. Only used in serverless_mode; defaults to 'Unknown' when account_id is set. Locally configured values are ignored outside serverless_mode."},"proxy":{"x-newrelic-env-var":"NEW_RELIC_PROXY_URL","type":"string","default":"","description":"Proxy url A proxy url can be used in place of setting proxy_host, proxy_port, proxy_user, and proxy_pass. e.g. http://user:pass@host:port/ Setting proxy will override other proxy settings."},"proxy_host":{"type":"string","default":"","description":"Proxy host to use to connect to the internet."},"proxy_pass":{"type":"string","default":"","description":"Proxy password when required."},"proxy_port":{"type":"string","default":"","description":"Proxy port to use to connect to the internet."},"proxy_user":{"type":"string","default":"","description":"Proxy user name when required."},"ssl":{"x-newrelic-env-var":"NEW_RELIC_USE_SSL","type":"boolean","const":true,"default":true,"x-newrelic-internal":true,"description":"Whether or not to use SSL to connect to New Relic servers. This can no longer be disabled; the only permitted value is true."},"trusted_account_key":{"type":["string","number","null"],"default":null,"description":"The trusted account key used to validate incoming distributed trace headers. Only used in serverless_mode; defaults to account_id when account_id is set. Locally configured values are ignored outside serverless_mode."},"agent_control":{"$ref":"agent-control.js"},"ai_monitoring":{"$ref":"ai-monitoring.js"},"api":{"$ref":"api.js"},"apollo_server":{"$ref":"apollo-server.js"},"application_logging":{"$ref":"application-logging.js"},"attributes":{"$ref":"attributes.js"},"audit_log":{"$ref":"audit-log.js"},"browser_monitoring":{"$ref":"browser-monitoring.js"},"cloud":{"$ref":"cloud.js"},"code_level_metrics":{"$ref":"code-level-metrics.js"},"custom_insights_events":{"$ref":"custom-insights-events.js"},"datastore_tracer":{"$ref":"datastore-tracer.js"},"distributed_tracing":{"$ref":"distributed-tracing.js"},"error_collector":{"$ref":"error-collector.js"},"grpc":{"$ref":"grpc.js"},"heroku":{"$ref":"heroku.js"},"infinite_tracing":{"$ref":"infinite-tracing.js"},"instrumentation":{"$ref":"instrumentation.js"},"kafka":{"$ref":"kafka.js"},"logging":{"$ref":"logging.js"},"message_tracer":{"$ref":"message-tracer.js"},"opentelemetry":{"$ref":"opentelemetry.js"},"plugins":{"$ref":"plugins.js"},"process_host":{"$ref":"process-host.js"},"profiling":{"$ref":"profiling.js"},"rules":{"$ref":"rules.js"},"security":{"$ref":"security.js"},"serverless_mode":{"$ref":"serverless-mode.js"},"slow_sql":{"$ref":"slow-sql.js"},"span_events":{"$ref":"span-events.js"},"strip_exception_messages":{"$ref":"strip-exception-messages.js"},"transaction_events":{"$ref":"transaction-events.js"},"transaction_segments":{"$ref":"transaction-segments.js"},"transaction_tracer":{"$ref":"transaction-tracer.js"},"url_obfuscation":{"$ref":"url-obfuscation.js"},"utilization":{"$ref":"utilization.js"},"worker_threads":{"$ref":"worker-threads.js"}}};const schema32 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"agent-control.js","type":"object","x-newrelic-internal":true,"properties":{"enabled":{"type":"boolean","default":false,"description":"Indicates that the agent is being managed by Agent Control. Must be set to true for health monitoring."},"health":{"type":"object","properties":{"delivery_location":{"type":"string","default":"file:///newrelic/apm/health","description":"A string file path to a directory that the agent is expected to write health status files to. Must be set for health monitoring to be enabled."},"frequency":{"type":"integer","default":5,"description":"An integer representing how often the agent should write to the health status file(s), in seconds."}},"additionalProperties":true}},"additionalProperties":true,"description":"Settings for integration with Agent Control. Set by Agent Control, not user-facing."};const schema33 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"ai-monitoring.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Toggles the generation of AI monitoring events by the agent."},"record_content":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true,"description":"When enabled, the content of LLM messages will be included in the recorded spans (i.e. delivered to the New Relic collector). This is enabled by default."},"streaming":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true,"description":"Toggles the capturing of Llm events when using streaming based methods in AIM supported libraries(i.e.- openai, AWS bedrock, langchain)"}},"additionalProperties":true,"description":"When enabled, instrumentation of supported AI libraries will be in effect."};const schema34 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"api.js","type":"object","properties":{"custom_attributes_enabled":{"x-newrelic-env-var":"NEW_RELIC_API_CUSTOM_ATTRIBUTES","type":"boolean","default":true,"description":"Controls for the `API.addCustomAttribute` method."},"custom_events_enabled":{"x-newrelic-env-var":"NEW_RELIC_API_CUSTOM_EVENTS","type":"boolean","default":true,"description":"Controls for the `API.recordCustomEvent` method."},"notice_error_enabled":{"x-newrelic-env-var":"NEW_RELIC_API_NOTICE_ERROR","type":"boolean","default":true,"description":"Controls for the `API.noticeError` method."}},"additionalProperties":true,"description":"API Configuration Some API end points can be turned off via configuration settings to allow for more flexible security options. All API configuration options are disabled when high-security mode is enabled."};const schema35 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"apollo-server.js","type":"object","properties":{"scalars":{"type":"boolean","default":false,"description":"Enable capture of timing of fields resolved with the GraphQLScalarType return type. This may be desired when performing time intensive calculations to return a scalar value. This is not recommended for queries that return a large number of pre-calculated scalar fields. NOTE: query/mutation resolvers will always be captured even if returning a scalar type."},"introspection_queries":{"type":"boolean","default":false,"description":"Enable capture of timings for an [IntrospectionQuery](https://www.graphql-js.org/api-v16/utilities/#introspectionquery)"},"service_definition_queries":{"type":"boolean","default":false,"description":"Enable capture of timings for a [Service Definition query](https://www.apollographql.com/docs/federation/federation-spec/#fetch-service-capabilities) received from an Apollo Federated Gateway Server."},"health_check_queries":{"type":"boolean","default":false,"description":"Enable capture of timings for a [Health Check query](https://www.apollographql.com/docs/federation/api/apollo-gateway/#servicehealthcheck) received from an Apollo Federated Gateway Server."},"field_metrics":{"type":"boolean","default":false,"description":"Enable capture of metrics for every field and resolver argument seen for an Apollo query. This is intended to be used to check for any unused fields in your graphql schema."}},"additionalProperties":true,"description":"Stanza for customizing behavior for apollo server instrumentation"};const schema36 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"application-logging.js","type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"Toggles the ability for all application logging features to be enabled."},"forwarding":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"Toggles whether the agent gathers log records for sending to New Relic."},"max_samples_stored":{"type":"integer","default":10000,"description":"Number of log records to send per minute to New Relic."},"labels":{"type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"If `true`, the agent attaches labels to log records."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"A case-insensitive array containing the labels to exclude from log records."}},"additionalProperties":true}},"additionalProperties":true},"metrics":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"Toggles whether the agent gathers logging metrics."}},"additionalProperties":true},"local_decorating":{"type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Toggles whether the agent performs log decoration on standard log output."}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls the behavior of Logs in Context within agent"};const schema37 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"attributes.js","type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, enables capture of attributes for all destinations. If there are specific parameters you want ignored, use `attributes.exclude`."},"value_size_limit":{"type":"integer","default":256,"maximum":4096,"description":"Defines the number of characters allowed for each individual attribute's value. The default is 256 characters, with a maximum of 4,096."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude from all destinations. Allows * as wildcard at end. NOTE: If excluding headers, they must be in camelCase form to be filtered."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in all destinations. Allows * as wildcard at end. NOTE: If including headers, they must be in camelCase form to be filtered."},"include_enabled":{"type":"boolean","default":true,"description":"If `true`, patterns may be added to the `attributes.include` list."},"filter_cache_limit":{"type":"integer","default":1000,"description":"Controls how many attribute include/exclude rule results are cached by the filter. Increasing this limit will cause greater memory usage and is only necessary if you have an extremely high variety of attributes."}},"additionalProperties":true,"description":"Attributes are key-value pairs containing information that determines the properties of an event or transaction."};const schema38 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"audit-log.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Enables logging of out bound traffic from the Agent to the Collector. This field is ignored if trace level logging is enabled. With trace logging, all traffic is logged."},"endpoints":{"type":"array","items":{"type":"string"},"default":[],"description":"Specify which methods are logged. Used in conjunction with the audit_log flag If audit_log is enabled and this property is empty, all methods will be logged Otherwise, if the audit log is enabled, only the methods specified in the filter will be logged Methods include: error_data, metric_data, and analytic_event_data"}},"additionalProperties":true};const schema39 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"browser-monitoring.js","type":"object","properties":{"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"If `true`, the agent captures attributes from browser monitoring."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude from browser monitoring. Allows * as wildcard at end."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in browser monitoring. Allows * as wildcard at end."}},"additionalProperties":true},"enable":{"x-newrelic-env-var":"NEW_RELIC_BROWSER_MONITOR_ENABLE","type":"boolean","default":true,"description":"Enable browser monitoring header generation. This does not auto-instrument, rather it enables the agent to generate headers. The newrelic module can generate the appropriate <script> header, but you must inject the header yourself, or use a module that does so. This generates the <script>...</script> header necessary for Browser Monitoring This script must be manually injected into your templates, as high as possible in the header, but _after_ any X-UA-COMPATIBLE HTTP-EQUIV meta tags. Otherwise you may hurt IE! This method must be called _during_ a transaction, and must be called every time you want to generate the headers. Do *not* reuse the headers between users, or even between requests."},"debug":{"x-newrelic-env-var":"NEW_RELIC_BROWSER_MONITOR_DEBUG","type":"boolean","default":false,"description":"Request un-minified sources from the server."},"version":{"type":"string","default":"","description":"The browser agent loader version to request, e.g. `\"1.317.0\"`. See the [browser agent EOL policy](https://docs.newrelic.com/docs/browser/browser-monitoring/getting-started/browser-agent-eol-policy/) for which versions are currently available and supported."}},"additionalProperties":true,"description":"Browser Monitoring Browser monitoring lets you correlate transactions between the server and browser giving you accurate data on how long a page request takes, from request, through the server response, up until the actual page render completes."};const schema40 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"cloud.js","type":"object","properties":{"aws":{"type":"object","properties":{"account_id":{"type":"integer","default":null,"description":"The AWS account ID for the AWS account associated with this app."}},"additionalProperties":true}},"additionalProperties":true};const schema41 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"code-level-metrics.js","type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true,"description":"Toggles whether to capture code.* attributes on spans"};const schema42 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"custom-insights-events.js","type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If this is disabled, the agent does not collect, nor try to send, custom event data."},"max_samples_stored":{"type":"integer","default":3000,"description":"The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected. Currently this uses a priority sampling algorithm. By increasing this setting you are both increasing the memory requirements of the agent as well as increasing the payload to the New Relic servers. The memory concerns are something you should consider for your own server's sake. The payload of events is compressed, but if it grows too large the New Relic servers may reject it."}},"additionalProperties":true,"description":"Custom Insights Events Custom insights events are JSON object that are sent to New Relic Insights. You can tell the agent to send your custom events via the `newrelic.recordCustomEvent()` API. These events are sampled once the max queue size is reached. You can tune this setting below. Read more here: http://newrelic.com/insights"};const schema43 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"datastore-tracer.js","type":"object","properties":{"instance_reporting":{"type":"object","properties":{"enabled":{"x-newrelic-env-var":"NEW_RELIC_DATASTORE_INSTANCE_REPORTING_ENABLED","type":"boolean","default":true}},"additionalProperties":true},"database_name_reporting":{"type":"object","properties":{"enabled":{"x-newrelic-env-var":"NEW_RELIC_DATASTORE_DATABASE_NAME_REPORTING_ENABLED","type":"boolean","default":true}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls behavior of datastore instance metrics. Enables reporting the host and port/path/id of database servers. Default is `true`. Enables reporting of database/schema names. Default is `true`."};const schema44 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"distributed-tracing.js","type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"Enables/disables distributed tracing."},"exclude_newrelic_header":{"type":"boolean","default":true,"description":"Excludes New Relic format distributed tracing header (`newrelic`) on outbound requests when set to `true`. By default (when false) both W3C TraceContext (`traceparent`, `tracecontext`) and New Relic formats will be sent."},"sampler":{"type":"object","properties":{"root":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"},"remote_parent_sampled":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"When set to `always_on`, the sampled flag in the `traceparent` header being set to \"true\" will result in the local transaction being sampled with a priority value of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting."},"remote_parent_not_sampled":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"When set to `always_on`, the local transaction will be sampled with a priority of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0."},"adaptive_sampling_target":{"type":"integer","default":10,"minimum":1,"maximum":120,"description":"The sampling target for adaptive sampling is controlled via this attribute when configuring the default/adaptive sampler. The default sampling target is 10 transactions/min when it is not specified but **MUST** be within the range of [1, 120] (inclusive). Upon agent connect, the connect response **MUST** provide the value of `sampling_target` based on this configuration setting's value. The `sampling_target` value from the connect response **SHOULD** be used as the sampling target value for adaptive sampling in the agent."},"full_granularity":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true},"partial_granularity":{"type":"object","properties":{"enabled":{"type":"boolean","default":false},"type":{"x-newrelic-coerce":"allowList","type":"string","enum":["compact","essential","reduced"],"default":"essential"},"root":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"},"remote_parent_sampled":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"When set to `always_on`, the sampled flag in the `traceparent` header being set to \"true\" will result in the local transaction being sampled with a priority value of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting."},"remote_parent_not_sampled":{"oneOf":[{"type":"string","enum":["always_on","always_off","adaptive"]},{"type":"object","properties":{"trace_id_ratio_based":{"type":"object","properties":{"ratio":{"type":"number"}},"required":["ratio"],"additionalProperties":true}},"required":["trace_id_ratio_based"],"additionalProperties":true},{"type":"object","properties":{"adaptive":{"type":"object","properties":{"sampling_target":{"type":"integer","minimum":1,"maximum":120}},"additionalProperties":true}},"required":["adaptive"],"additionalProperties":true}],"default":"adaptive","x-newrelic-sampler":true,"description":"When set to `always_on`, the local transaction will be sampled with a priority of \"2\". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0."}},"additionalProperties":true}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls the method of cross agent tracing in the agent. Distributed tracing lets you see the path that a request takes through your distributed system. Enabling distributed tracing changes the behavior of some New Relic features, so carefully consult the transition guide before you enable this feature: https://docs.newrelic.com/docs/transition-guide-distributed-tracing Default is true."};const schema45 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"error-collector.js","type":"object","properties":{"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, the agent captures attributes from error collection."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude from error collection. Allows * as wildcard at end."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in error collection. Allows * as wildcard at end."}},"additionalProperties":true},"enabled":{"type":"boolean","default":true,"description":"Disabling the error tracer just means that errors aren't collected and sent to New Relic -- it DOES NOT remove any instrumentation."},"ignore_status_codes":{"x-newrelic-env-var":"NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES","type":"array","items":{"type":"string"},"default":[404],"description":"List of HTTP error status codes the error tracer should disregard. Ignoring a status code means that the transaction is not renamed to match the code, and the request is not treated as an error by the error collector. NOTE: This configuration value has no effect on errors recorded using `noticeError()`. Defaults to 404 NOT FOUND."},"capture_events":{"type":"boolean","default":true,"description":"Whether error events are collected."},"max_event_samples_stored":{"type":"integer","default":100,"description":"The agent will collect all error events up to this number per minute. If there are more than that, a statistical sampling will be collected. Currently this uses a priority sampling algorithm. By increasing this setting you are both increasing the memory requirements of the agent as well as increasing the payload to the New Relic servers. The memory concerns are something you should consider for your own server's sake. The payload of events is compressed, but if it grows too large the New Relic servers may reject it."},"expected_classes":{"x-newrelic-env-var":"NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERRORS","type":"array","items":{"type":"string"},"default":[]},"expected_messages":{"x-newrelic-coerce":"object","type":"object","additionalProperties":true,"default":{}},"expected_status_codes":{"x-newrelic-env-var":"NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES","type":"array","items":{"type":"string"},"default":[]},"ignore_classes":{"x-newrelic-env-var":"NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERRORS","type":"array","items":{"type":"string"},"default":[]},"ignore_messages":{"x-newrelic-coerce":"object","type":"object","additionalProperties":true,"default":{}}},"additionalProperties":true,"description":"Whether to collect & submit error traces to New Relic."};const schema46 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"grpc.js","type":"object","properties":{"record_errors":{"type":"boolean","default":true,"description":"Enables recording of non-zero gRPC status codes. Default is `true`."},"ignore_status_codes":{"type":"array","items":{"type":"string"},"default":[],"description":"List of gRPC error status codes the error tracer should disregard. Ignoring a status code means that the transaction is not renamed to match the code, and the request is not treated as an error by the error collector. NOTE: This configuration value has no effect on errors recorded using `noticeError()`. Defaults to no codes ignored."}},"additionalProperties":true,"description":"Controls behavior of gRPC server instrumentation."};const schema47 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"heroku.js","type":"object","properties":{"use_dyno_names":{"type":"boolean","default":true}},"additionalProperties":true,"description":"When enabled, it will use `process.env.DYNO` to set the hostname of the running application"};const schema48 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"infinite-tracing.js","type":"object","properties":{"trace_observer":{"type":"object","properties":{"host":{"type":"string","default":"","description":"The URI HOST of the observer. Setting this enables infinite tracing."},"port":{"type":"integer","default":443,"description":"The URI PORT of the observer."},"insecure":{"type":"boolean","default":false,"x-newrelic-internal":true,"description":"Whether to connect to the trace observer without TLS. Internal use only."}},"additionalProperties":true},"span_events":{"type":"object","properties":{"queue_size":{"type":"integer","default":10000,"description":"The amount of spans to hold onto before dropping them"},"batch_size":{"type":"integer","default":750,"description":"Size of batches to post to 8T server"}},"additionalProperties":true},"batching":{"type":"boolean","default":true},"compression":{"type":"boolean","default":true}},"additionalProperties":true,"description":"Controls the use of infinite tracing."};const schema49 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"instrumentation.js","type":"object","description":"Stanza that contains all keys to disable core & 3rd party package instrumentation(i.e. dns, http, mongodb, pg, redis, etc) **Note**: Disabling a given library may affect the instrumentation of libraries used after the disabled library. Use at your own risk.","additionalProperties":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"properties":{"@anthropic-ai/sdk":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@apollo/server":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@aws-sdk/smithy-client":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@azure/functions":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@elastic/elasticsearch":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@elastic/transport":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@google/adk":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@google/genai":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@grpc/grpc-js":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@hapi/hapi":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@hapi/vision":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@langchain/core":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@langchain/langgraph":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@modelcontextprotocol/sdk":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@modelcontextprotocol/sdk/client/index.js":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@nestjs/core":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@node-redis/client":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@opensearch-project/opensearch":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@prisma/client":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@redis/client":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@smithy/core":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"@smithy/smithy-client":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"amqplib":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"amqplib/callback_api":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"aws-sdk":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"bluebird":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"bunyan":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"cassandra-driver":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"child_process":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"connect":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"crypto":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"dns":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"express":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"fastify":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"fs":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"http":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"http2":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"https":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"ioredis":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"iovalkey":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"kafkajs":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"koa":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"memcached":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"mongodb":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"mysql":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"mysql2":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"net":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"next":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"openai":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"pg":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"pino":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"q":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"redis":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"restify":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"router":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"timers":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":false,"description":"Whether instrumentation for this module is active."}}},"undici":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"when":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"winston":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}},"zlib":{"type":"object","additionalProperties":true,"properties":{"enabled":{"type":"boolean","default":true,"description":"Whether instrumentation for this module is active."}}}}};const schema50 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"kafka.js","type":"object","properties":{"metrics":{"type":"object","properties":{"cluster":{"type":"object","properties":{"metrics":{"type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Enables capture of the `MessageBroker/Kafka/Cluster/{cluster_id}/{Produce|Consume}/{topic_name}` metrics. Disabled by default."}},"additionalProperties":true}},"additionalProperties":true}},"additionalProperties":true}},"additionalProperties":true,"description":"Stanza for customizing behavior for Kafka instrumentation"};const schema51 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"logging.js","type":"object","properties":{"level":{"type":"string","default":"info","description":"Verbosity of the module's logging. This module uses bunyan (https://github.com/trentm/node-bunyan) for its logging, and as such the valid logging levels are 'fatal', 'error', 'warn', 'info', 'debug' and 'trace'. Logging at levels 'info' and higher is very terse. For support requests, attaching logs captured at 'trace' level are extremely helpful in chasing down bugs.","x-newrelic-env-var":"NEW_RELIC_LOG_LEVEL"},"filepath":{"type":"string","description":"Where to put the log file -- by default just uses process.cwd + 'newrelic_agent.log'. A special case is a filepath of 'stdout', in which case all logging will go to stdout, or 'stderr', in which case all logging will go to stderr.","x-newrelic-env-var":"NEW_RELIC_LOG"},"enabled":{"type":"boolean","default":true,"description":"Whether to write to a log file at all","x-newrelic-env-var":"NEW_RELIC_LOG_ENABLED"},"diagnostics":{"type":"boolean","default":false,"x-newrelic-internal":true,"description":"Whether to enable internal agent diagnostics logging."}},"additionalProperties":true};const schema52 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"message-tracer.js","type":"object","properties":{"segment_parameters":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls behavior of message broker tracing. Enables reporting parameters on message broker segments."};const schema53 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"opentelemetry.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Global switch for the whole OpenTelemetry feature. If it is set to `false`, any other sub-feature, e.g. `traces`, will not be enabled regardless of that specific sub-feature setting."},"traces":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true,"description":"`traces` are instrumentations, e.g. `@fastify/otel`. Enabling `traces` enables bridging OpenTelemetry instrumentations into the New Relic agent."},"logs":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true,"description":"`logs` governs automatic configuration of the OpenTelemetry logs API. When true, the agent will automatically configure the logs API to send logs emitted through the OTEL specific API to New Relic. This feature is dependent on application logs forwarding. Thus, application logs forwarding must be enabled as well."},"metrics":{"type":"object","properties":{"enabled":{"type":"boolean","default":true},"export_interval":{"type":"integer","default":60000,"description":"`export_interval` defines the number of milliseconds between each attempt to ship metrics to New Relic. This value must be equal to or greater than the value of `export_timeout`."},"export_timeout":{"type":"integer","default":10000,"description":"`export_timeout` defines the number of milliseconds an export operation is allowed in order to successfully complete. If the timeout is exceeded, it will be reported via the OpenTelemetry diagnostics API."}},"additionalProperties":true,"description":"`metrics` governs automatic configuration of the OpenTelemetry metrics API. When `true`, the agent will automatically configure the metrics API to send metrics to New Relic and attach them to the application entity that is instrumented by the New Relic agent."}},"additionalProperties":true,"description":"Governs the various OpenTelemetry based features provided by the agent. NOTICE: this configuration is subject to change while the OTEL feature set is in development."};const schema54 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"plugins.js","type":"object","properties":{"native_metrics":{"type":"object","properties":{"enabled":{"x-newrelic-env-var":"NEW_RELIC_NATIVE_METRICS_ENABLED","type":"boolean","default":true}},"additionalProperties":true,"description":"Controls usage of the native metrics module which samples VM and event loop data."}},"additionalProperties":true};const schema55 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"process-host.js","type":"object","properties":{"display_name":{"type":"string","default":"","description":"Configurable display name for hosts"},"ipv_preference":{"x-newrelic-env-var":"NEW_RELIC_IPV_PREFERENCE","x-newrelic-coerce":"allowList","type":"string","enum":["4","6"],"default":"4","description":"ip address preference when creating hostnames"}},"additionalProperties":true,"description":"This is used to configure properties about the user's host name."};const schema56 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"profiling.js","type":"object","properties":{"enabled":{"type":"boolean","default":false},"include":{"type":"array","items":{"type":"string"},"default":["cpu","heap"],"description":"List of profile type names to enable. Only cpu and heap profiles are currently supported"},"delay":{"type":"integer","default":0,"description":"Delay in milliseconds before starting profiler."},"duration":{"type":"integer","default":0,"description":"If >0, stop profiler after this many milliseconds of operation."},"source_mapping":{"type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"When set to `true`, resolves profiler frames to their original source files/lines using source maps, instead of the compiled output."}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls the behavior of the profiler."};const schema57 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"rules.js","type":"object","properties":{"name":{"x-newrelic-env-var":"NEW_RELIC_NAMING_RULES","x-newrelic-coerce":"objectList","type":"array","items":{},"default":[],"description":"A list of rules of the format {pattern: 'pattern', name: 'name'} for matching incoming request URLs and naming the associated New Relic transactions. Both pattern and name are required. Additional attributes are ignored. Patterns may have capture groups (following JavaScript conventions), and names will use $1-style replacement strings. See the documentation for addNamingRule for important caveats."},"ignore":{"x-newrelic-env-var":"NEW_RELIC_IGNORING_RULES","type":"array","items":{"type":["string","object"]},"default":["^/socket.io/.*/xhr-polling/"],"description":"A list of patterns for matching incoming request URLs to be ignored by the agent. Patterns may be strings or regular expressions. By default, socket.io long-polling is ignored. env NEW_RELIC_IGNORING_RULES"}},"additionalProperties":true,"description":"Rules for naming or ignoring transactions."};const schema58 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"security.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Toggles the generation of security events by the security agent."},"agent":{"type":"object","properties":{"enabled":{"type":"boolean","default":false}},"additionalProperties":true,"description":"Flag to tell the Node.js agent to load the security agent. This property is read only once at application start."},"mode":{"x-newrelic-coerce":"allowList","type":"string","enum":["IAST","RASP"],"default":"IAST","description":"Security agent provides two modes: IAST and RASP. Default is IAST."},"validator_service_url":{"type":"string","default":"wss://csec.nr-data.net","description":"Security agent validator URL. Must be prefixed with wss://."},"detection":{"type":"object","properties":{"rci":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true},"rxss":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true},"deserialization":{"type":"object","properties":{"enabled":{"type":"boolean","default":true}},"additionalProperties":true}},"additionalProperties":true,"description":"Provide ability to toggle sending security events for the following rules."},"iast_test_identifier":{"type":"string","default":"","description":"Unique test identifier when running IAST with CI/CD"},"scan_controllers":{"type":"object","properties":{"iast_scan_request_rate_limit":{"type":"integer","default":3600,"description":"The maximum number of analysis probes or requests that can be sent to the application in one minute."},"scan_instance_count":{"type":"integer","default":0,"description":"The number of application instances for a specific entity where IAST analysis is performed. Values are 0 or 1, 0 signifies run on all application instances"}},"additionalProperties":true,"description":"IAST scan controllers to get more control over IAST analysis"},"scan_schedule":{"type":"object","properties":{"delay":{"type":"integer","default":0,"description":"The delay field specifies the time in minutes before an IAST scan begins after the application starts"},"duration":{"type":"integer","default":0,"description":"The duration field specifies the amount of time in minutes that the IAST scan will run"},"schedule":{"type":"string","default":"","description":"The schedule field specifies a unix cron expression that defines when the IAST scan should run. By default, schedule is disabled"},"always_sample_traces":{"type":"boolean","default":false,"description":"Allows IAST to actively collect trace data in the background and the security agent will use this collected data to perform an IAST scan at the scheduled time"}},"additionalProperties":true,"description":"Schedule start and stop of IAST scan"},"exclude_from_iast_scan":{"type":"object","properties":{"api":{"type":"array","items":{"type":"string"},"default":[],"description":"Ignore specific APIs from IAST analysis. The regex pattern should provide a full match for the URL without the endpoint."},"http_request_parameters":{"type":"object","properties":{"header":{"type":"array","items":{"type":"string"},"default":[]},"query":{"type":"array","items":{"type":"string"},"default":[]},"body":{"type":"array","items":{"type":"string"},"default":[]}},"additionalProperties":true,"description":"Ignore specific HTTP request parameters from IAST analysis."},"iast_detection_category":{"type":"object","properties":{"insecure_settings":{"type":"boolean","default":false},"invalid_file_access":{"type":"boolean","default":false},"sql_injection":{"type":"boolean","default":false},"nosql_injection":{"type":"boolean","default":false},"ldap_injection":{"type":"boolean","default":false},"javascript_injection":{"type":"boolean","default":false},"command_injection":{"type":"boolean","default":false},"xpath_injection":{"type":"boolean","default":false},"ssrf":{"type":"boolean","default":false},"rxss":{"type":"boolean","default":false}},"additionalProperties":true,"description":"Allows users to specify categories of vulnerabilities for which IAST analysis will be applied or ignored."}},"additionalProperties":true,"description":"The exclude from IAST scan setting allows to exclude specific APIs, vulnerability categories, and parameters from IAST analysis."}},"additionalProperties":true,"description":"Security agent configurations"};const schema59 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"serverless-mode.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Specifies whether the agent will be used to monitor serverless functions (e.g. AWS Lambda). Defaults to true when the AWS_LAMBDA_FUNCTION_NAME environment variable is present, false otherwise."}},"additionalProperties":true,"description":"Specifies whether the agent will be used to monitor serverless functions. For example: AWS Lambda"};const schema60 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"slow-sql.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Enables and disables `slow_sql` recording."},"max_samples":{"x-newrelic-env-var":"NEW_RELIC_MAX_SQL_SAMPLES","type":"integer","default":10,"description":"Sets the maximum number of slow query samples that will be collected in a single harvest cycle. env NEW_RELIC_MAX_SQL_SAMPLES"}},"additionalProperties":true,"description":"These options control behavior for slow queries, but do not affect sql nodes in transaction traces."};const schema61 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"span-events.js","type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"Enables/disables span event generation"},"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, the agent captures attributes from span events."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude in span events. Allows * as wildcard at end."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in span events. Allows * as wildcard at end."}},"additionalProperties":true},"max_samples_stored":{"type":"integer","default":2000,"description":"The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected."}},"additionalProperties":true,"description":"Controls the behavior of span events produced by the agent."};const schema62 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"strip-exception-messages.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"When `true`, the agent will redact the messages of captured errors."}},"additionalProperties":true,"description":"Error message redaction Options regarding how the agent handles the redaction of error messages."};const schema63 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"transaction-events.js","type":"object","properties":{"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, the agent captures attributes from transaction events."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude in transaction events. Allows * as wildcard at end. env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_EXCLUDE"},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in transaction events. Allows * as wildcard at end. env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_INCLUDE"}},"additionalProperties":true},"enabled":{"type":"boolean","default":true,"description":"If this is disabled, the agent does not collect, nor try to send, analytic data."},"max_samples_stored":{"type":"integer","default":10000,"description":"The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected."}},"additionalProperties":true,"description":"Transaction Events Transaction events are sent to New Relic Insights. This event data includes transaction timing, transaction name, and any custom parameters. Read more here: http://newrelic.com/insights"};const schema64 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"transaction-segments.js","type":"object","properties":{"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, the agent captures attributes from transaction segments."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude in transaction segments. Allows * as wildcard at end."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in transaction segments. Allows * as wildcard at end."}},"additionalProperties":true}},"additionalProperties":true,"description":"Controls the behavior of transaction segments produced by the agent."};const schema65 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"transaction-tracer.js","type":"object","properties":{"attributes":{"type":"object","properties":{"enabled":{"type":"boolean","default":true,"description":"If `true`, the agent captures attributes from transaction traces."},"exclude":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to exclude from transaction traces. Allows * as wildcard at end."},"include":{"type":"array","items":{"type":"string"},"default":[],"description":"Prefix of attributes to include in transaction traces. Allows * as wildcard at end."}},"additionalProperties":true},"enabled":{"x-newrelic-env-var":"NEW_RELIC_TRACER_ENABLED","type":"boolean","default":true,"description":"Whether to collect & submit slow transaction traces to New Relic. The instrumentation is loaded regardless of this setting, as it's necessary to gather metrics. Disable the agent to prevent the instrumentation from loading."},"transaction_threshold":{"x-newrelic-env-var":"NEW_RELIC_TRACER_THRESHOLD","x-newrelic-coerce":"numericOrString","type":["number","string"],"default":"apdex_f","description":"Sets the time, in seconds, for a transaction to be considered slow. When a transaction exceeds this threshold, a transaction trace will be recorded. When set to 'apdex_f', the threshold will be set to 4 * apdex_t, which with a default apdex_t value of 500 milliseconds will be 2 seconds. If a number is provided, it is set in seconds."},"top_n":{"x-newrelic-env-var":"NEW_RELIC_TRACER_TOP_N","type":"integer","default":20,"description":"Increase this parameter to increase the diversity of the slow transaction traces recorded by your application over time. Confused? Read on. Transactions are named based on the request (see the README for the details of how requests are mapped to transactions), and top_n refers to the \"top n slowest transactions\" grouped by these names. The module will only replace a recorded trace with a new trace if the new trace is slower than the previous slowest trace of that name. The default value for this setting is 20, as the transaction trace view page also defaults to showing the 20 slowest transactions. If you want to record the absolute slowest transaction over the last minute, set top_n to 0 or 1. This used to be the default, and has a problem in that it will allow one very slow route to dominate your slow transaction traces. The module will always record at least 5 different slow transactions in the reporting periods after it starts up, and will reset its internal slow trace aggregator if no slow transactions have been recorded for the last 5 harvest cycles, restarting the aggregation process. env NEW_RELIC_TRACER_TOP_N"},"record_sql":{"x-newrelic-env-var":"NEW_RELIC_RECORD_SQL","x-newrelic-coerce":"allowList","type":"string","enum":["off","obfuscated","raw"],"default":"obfuscated","description":"This option affects both slow-queries and record_sql for transaction traces. It can have one of 3 values: 'off', 'obfuscated' or 'raw' When it is 'off' no slow queries will be captured, and backtraces and sql will not be included in transaction traces. If it is 'raw' or 'obfuscated' and other criteria (slow_sql.enabled etc) are met for a query. The raw or obfuscated sql will be included in the transaction trace and a slow query sample will be collected."},"explain_threshold":{"x-newrelic-env-var":"NEW_RELIC_EXPLAIN_THRESHOLD","type":"integer","default":500,"description":"This option affects both slow-queries and record_sql for transaction traces. This is the minimum duration a query must take (in ms) for it to be considered for for slow query and inclusion in transaction traces."}},"additionalProperties":true};const schema66 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"url-obfuscation.js","type":"object","properties":{"enabled":{"type":"boolean","default":false,"description":"Toggles whether to obfuscate URL parameters"},"regex":{"type":"object","properties":{"pattern":{"x-newrelic-coerce":"regex","type":"string","description":"Must be a valid regular expression.","default":null},"flags":{"type":"string","default":"","description":"A string containing RegEx flags to use when matching URL parameters"},"replacement":{"type":"string","default":"","description":"A string containing a replacement value for URL parameters can contain references to capture groups in the pattern"}},"additionalProperties":true}},"additionalProperties":true,"description":"Obfuscates URL parameters for outgoing and incoming requests for distributed tracing attributes - both transaction and span attributes for transaction trace transaction details"};const schema67 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"utilization.js","type":"object","properties":{"detect_aws":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to reach out to AWS to get info about the vm the process is running on."},"detect_pcf":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to detect if the the process is running on Pivotal Cloud Foundry."},"detect_azure":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to reach out to Azure to get info about the vm the process is running on."},"detect_azurefunction":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to read environment variables and invocation context to get info about the Azure Function called."},"detect_docker":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to read files to get info about the container the process is running in. env NEW_RELIC_UTILIZATION_DETECT_DOCKER"},"detect_gcp":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to reach out to GCP to get info about the vm the process is running on."},"detect_kubernetes":{"type":"boolean","default":true,"description":"This flag dictates whether the agent attempts to reach out to Kubernetes to get info about the container the process is running on."},"logical_processors":{"type":"number","default":null},"billing_hostname":{"type":["string","null"],"default":null},"total_ram_mib":{"type":"integer","default":null},"gcp_use_instance_as_host":{"type":"boolean","default":true,"description":"Deprecated and will be removed in v15 of the agent. Please use `utilization.gcp_cloud_run.use_instance_as_host` instead. When enabled, it will use the GCP metadata id to set the hostname of the running application (Services, Worker Pools, and Jobs)."},"gcp_cloud_run":{"type":"object","properties":{"include_revision_in_host":{"type":"boolean","default":false,"description":"If `true`, the agent prepends the Cloud Run revision name to the GCP instance id to form the hostname (`{revision}-{instance id}`) on Google Cloud Run. The revision name comes from `K_REVISION` on a Cloud Run Service, `CLOUD_RUN_REVISION` on a Cloud Run Worker Pool, and `CLOUD_RUN_EXECUTION` on a Cloud Run Job. Has no effect unless `utilization.gcp_use_instance_as_host` is also `true`."},"use_instance_as_host":{"type":"boolean","default":true,"description":"When enabled, it will use the GCP metadata id to set the hostname of the running application (Services, Worker Pools, and Jobs)."}},"additionalProperties":true}},"additionalProperties":true,"description":"Options regarding collecting system information. Used for system utilization based pricing scheme."};const schema68 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"worker-threads.js","type":"object","properties":{"enabled":{"type":"boolean","default":false}},"additionalProperties":true,"description":"When enabled, it will allow loading of the agent in worker threads. In 11.0.0 we added code to prevent loading in worker threads to cut down on unnecessary overhead of the agent. We have found in testing that traces and spans were useless unless work was completely self contained in the worker thread."};const func1 = Object.prototype.hasOwnProperty;function validate20(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){/*# sourceURL="root.js" */;let vErrors = null;let errors = 0;const evaluated0 = validate20.evaluated;if(evaluated0.dynamicProps){evaluated0.props = undefined;}if(evaluated0.dynamicItems){evaluated0.items = undefined;}if(data && typeof data == "object" && !Array.isArray(data)){if(data.account_id !== undefined){let data0 = data.account_id;if(((typeof data0 !== "string") && (!(typeof data0 == "number"))) && (data0 !== null)){let dataType0 = typeof data0;let coerced0 = undefined;if(!(coerced0 !== undefined)){if(dataType0 == "number" || dataType0 == "boolean"){coerced0 = "" + data0;}else if(data0 === null){coerced0 = "";}else if(dataType0 == "boolean" || data0 === null
                  || (dataType0 == "string" && data0 && data0 == +data0)){coerced0 = +data0;}else if(data0 === "" || data0 === 0 || data0 === false){coerced0 = null;}else {const err0 = {instancePath:instancePath+"/account_id",schemaPath:"#/properties/account_id/type",keyword:"type",params:{type: schema31.properties.account_id.type},message:"must be string,number,null"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}}if(coerced0 !== undefined){data0 = coerced0;if(data !== undefined){data["account_id"] = coerced0;}}}}if(data.agent_enabled !== undefined){let data1 = data.agent_enabled;if(typeof data1 !== "boolean"){let coerced1 = undefined;if(!(coerced1 !== undefined)){if(data1 === "false" || data1 === 0 || data1 === null){coerced1 = false;}else if(data1 === "true" || data1 === 1){coerced1 = true;}else {const err1 = {instancePath:instancePath+"/agent_enabled",schemaPath:"#/properties/agent_enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}}if(coerced1 !== undefined){data1 = coerced1;if(data !== undefined){data["agent_enabled"] = coerced1;}}}}if(data.allow_all_headers !== undefined){let data2 = data.allow_all_headers;if(typeof data2 !== "boolean"){let coerced2 = undefined;if(!(coerced2 !== undefined)){if(data2 === "false" || data2 === 0 || data2 === null){coerced2 = false;}else if(data2 === "true" || data2 === 1){coerced2 = true;}else {const err2 = {instancePath:instancePath+"/allow_all_headers",schemaPath:"#/properties/allow_all_headers/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;}}if(coerced2 !== undefined){data2 = coerced2;if(data !== undefined){data["allow_all_headers"] = coerced2;}}}}if(data.apdex_t !== undefined){let data3 = data.apdex_t;if(!(typeof data3 == "number")){let dataType3 = typeof data3;let coerced3 = undefined;if(!(coerced3 !== undefined)){if(dataType3 == "boolean" || data3 === null
                  || (dataType3 == "string" && data3 && data3 == +data3)){coerced3 = +data3;}else {const err3 = {instancePath:instancePath+"/apdex_t",schemaPath:"#/properties/apdex_t/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err3];}else {vErrors.push(err3);}errors++;}}if(coerced3 !== undefined){data3 = coerced3;if(data !== undefined){data["apdex_t"] = coerced3;}}}}if(data.apm_lambda_mode !== undefined){let data4 = data.apm_lambda_mode;if(typeof data4 !== "boolean"){let coerced4 = undefined;if(!(coerced4 !== undefined)){if(data4 === "false" || data4 === 0 || data4 === null){coerced4 = false;}else if(data4 === "true" || data4 === 1){coerced4 = true;}else {const err4 = {instancePath:instancePath+"/apm_lambda_mode",schemaPath:"#/properties/apm_lambda_mode/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err4];}else {vErrors.push(err4);}errors++;}}if(coerced4 !== undefined){data4 = coerced4;if(data !== undefined){data["apm_lambda_mode"] = coerced4;}}}}if(data.app_name !== undefined){let data5 = data.app_name;const _errs13 = errors;let valid1 = false;let passing0 = null;const _errs14 = errors;if(Array.isArray(data5)){const len0 = data5.length;for(let i0=0; i0<len0; i0++){let data6 = data5[i0];if(typeof data6 !== "string"){let dataType5 = typeof data6;let coerced5 = undefined;if(!(coerced5 !== undefined)){if(dataType5 == "number" || dataType5 == "boolean"){coerced5 = "" + data6;}else if(data6 === null){coerced5 = "";}else {const err5 = {instancePath:instancePath+"/app_name/" + i0,schemaPath:"#/properties/app_name/oneOf/0/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err5];}else {vErrors.push(err5);}errors++;}}if(coerced5 !== undefined){data6 = coerced5;if(data5 !== undefined){data5[i0] = coerced5;}}}}}else {const err6 = {instancePath:instancePath+"/app_name",schemaPath:"#/properties/app_name/oneOf/0/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err6];}else {vErrors.push(err6);}errors++;}var _valid0 = _errs14 === errors;if(_valid0){valid1 = true;passing0 = 0;}const _errs18 = errors;if(typeof data5 !== "string"){let dataType6 = typeof data5;let coerced6 = undefined;if(!(coerced6 !== undefined)){if(dataType6 == "number" || dataType6 == "boolean"){coerced6 = "" + data5;}else if(data5 === null){coerced6 = "";}else {const err7 = {instancePath:instancePath+"/app_name",schemaPath:"#/properties/app_name/oneOf/1/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err7];}else {vErrors.push(err7);}errors++;}}if(coerced6 !== undefined){data5 = coerced6;if(data !== undefined){data["app_name"] = coerced6;}}}var _valid0 = _errs18 === errors;if(_valid0 && valid1){valid1 = false;passing0 = [passing0, 1];}else {if(_valid0){valid1 = true;passing0 = 1;}}if(!valid1){const err8 = {instancePath:instancePath+"/app_name",schemaPath:"#/properties/app_name/oneOf",keyword:"oneOf",params:{passingSchemas: passing0},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err8];}else {vErrors.push(err8);}errors++;}else {errors = _errs13;if(vErrors !== null){if(_errs13){vErrors.length = _errs13;}else {vErrors = null;}}}}if(data.certificates !== undefined){let data7 = data.certificates;if(Array.isArray(data7)){const len1 = data7.length;for(let i1=0; i1<len1; i1++){let data8 = data7[i1];if(typeof data8 !== "string"){let dataType7 = typeof data8;let coerced7 = undefined;if(!(coerced7 !== undefined)){if(dataType7 == "number" || dataType7 == "boolean"){coerced7 = "" + data8;}else if(data8 === null){coerced7 = "";}else {const err9 = {instancePath:instancePath+"/certificates/" + i1,schemaPath:"#/properties/certificates/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err9];}else {vErrors.push(err9);}errors++;}}if(coerced7 !== undefined){data8 = coerced7;if(data7 !== undefined){data7[i1] = coerced7;}}}}}else {const err10 = {instancePath:instancePath+"/certificates",schemaPath:"#/properties/certificates/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err10];}else {vErrors.push(err10);}errors++;}}if(data.compressed_content_encoding !== undefined){let data9 = data.compressed_content_encoding;if(typeof data9 !== "string"){let dataType8 = typeof data9;let coerced8 = undefined;if(!(coerced8 !== undefined)){if(dataType8 == "number" || dataType8 == "boolean"){coerced8 = "" + data9;}else if(data9 === null){coerced8 = "";}else {const err11 = {instancePath:instancePath+"/compressed_content_encoding",schemaPath:"#/properties/compressed_content_encoding/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err11];}else {vErrors.push(err11);}errors++;}}if(coerced8 !== undefined){data9 = coerced8;if(data !== undefined){data["compressed_content_encoding"] = coerced8;}}}}if(data.enforce_backstop !== undefined){let data10 = data.enforce_backstop;if(typeof data10 !== "boolean"){let coerced9 = undefined;if(!(coerced9 !== undefined)){if(data10 === "false" || data10 === 0 || data10 === null){coerced9 = false;}else if(data10 === "true" || data10 === 1){coerced9 = true;}else {const err12 = {instancePath:instancePath+"/enforce_backstop",schemaPath:"#/properties/enforce_backstop/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err12];}else {vErrors.push(err12);}errors++;}}if(coerced9 !== undefined){data10 = coerced9;if(data !== undefined){data["enforce_backstop"] = coerced9;}}}}if(data.high_security !== undefined){let data11 = data.high_security;if(typeof data11 !== "boolean"){let coerced10 = undefined;if(!(coerced10 !== undefined)){if(data11 === "false" || data11 === 0 || data11 === null){coerced10 = false;}else if(data11 === "true" || data11 === 1){coerced10 = true;}else {const err13 = {instancePath:instancePath+"/high_security",schemaPath:"#/properties/high_security/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err13];}else {vErrors.push(err13);}errors++;}}if(coerced10 !== undefined){data11 = coerced10;if(data !== undefined){data["high_security"] = coerced10;}}}}if(data.host !== undefined){let data12 = data.host;if(typeof data12 !== "string"){let dataType11 = typeof data12;let coerced11 = undefined;if(!(coerced11 !== undefined)){if(dataType11 == "number" || dataType11 == "boolean"){coerced11 = "" + data12;}else if(data12 === null){coerced11 = "";}else {const err14 = {instancePath:instancePath+"/host",schemaPath:"#/properties/host/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err14];}else {vErrors.push(err14);}errors++;}}if(coerced11 !== undefined){data12 = coerced11;if(data !== undefined){data["host"] = coerced11;}}}}if(data.ignore_server_configuration !== undefined){let data13 = data.ignore_server_configuration;if(typeof data13 !== "boolean"){let coerced12 = undefined;if(!(coerced12 !== undefined)){if(data13 === "false" || data13 === 0 || data13 === null){coerced12 = false;}else if(data13 === "true" || data13 === 1){coerced12 = true;}else {const err15 = {instancePath:instancePath+"/ignore_server_configuration",schemaPath:"#/properties/ignore_server_configuration/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err15];}else {vErrors.push(err15);}errors++;}}if(coerced12 !== undefined){data13 = coerced12;if(data !== undefined){data["ignore_server_configuration"] = coerced12;}}}}if(data.labels !== undefined){let data14 = data.labels;const _errs35 = errors;let valid6 = false;let passing1 = null;const _errs36 = errors;if(!(data14 && typeof data14 == "object" && !Array.isArray(data14))){const err16 = {instancePath:instancePath+"/labels",schemaPath:"#/properties/labels/oneOf/0/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err16];}else {vErrors.push(err16);}errors++;}var _valid1 = _errs36 === errors;if(_valid1){valid6 = true;passing1 = 0;}const _errs38 = errors;if(typeof data14 !== "string"){let dataType13 = typeof data14;let coerced13 = undefined;if(!(coerced13 !== undefined)){if(dataType13 == "number" || dataType13 == "boolean"){coerced13 = "" + data14;}else if(data14 === null){coerced13 = "";}else {const err17 = {instancePath:instancePath+"/labels",schemaPath:"#/properties/labels/oneOf/1/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err17];}else {vErrors.push(err17);}errors++;}}if(coerced13 !== undefined){data14 = coerced13;if(data !== undefined){data["labels"] = coerced13;}}}var _valid1 = _errs38 === errors;if(_valid1 && valid6){valid6 = false;passing1 = [passing1, 1];}else {if(_valid1){valid6 = true;passing1 = 1;}}if(!valid6){const err18 = {instancePath:instancePath+"/labels",schemaPath:"#/properties/labels/oneOf",keyword:"oneOf",params:{passingSchemas: passing1},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err18];}else {vErrors.push(err18);}errors++;}else {errors = _errs35;if(vErrors !== null){if(_errs35){vErrors.length = _errs35;}else {vErrors = null;}}}}if(data.license_key !== undefined){let data15 = data.license_key;if(typeof data15 !== "string"){let dataType14 = typeof data15;let coerced14 = undefined;if(!(coerced14 !== undefined)){if(dataType14 == "number" || dataType14 == "boolean"){coerced14 = "" + data15;}else if(data15 === null){coerced14 = "";}else {const err19 = {instancePath:instancePath+"/license_key",schemaPath:"#/properties/license_key/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err19];}else {vErrors.push(err19);}errors++;}}if(coerced14 !== undefined){data15 = coerced14;if(data !== undefined){data["license_key"] = coerced14;}}}}if(data.newrelic_home !== undefined){let data16 = data.newrelic_home;if((typeof data16 !== "string") && (data16 !== null)){let dataType15 = typeof data16;let coerced15 = undefined;if(!(coerced15 !== undefined)){if(dataType15 == "number" || dataType15 == "boolean"){coerced15 = "" + data16;}else if(data16 === null){coerced15 = "";}else if(data16 === "" || data16 === 0 || data16 === false){coerced15 = null;}else {const err20 = {instancePath:instancePath+"/newrelic_home",schemaPath:"#/properties/newrelic_home/type",keyword:"type",params:{type: schema31.properties.newrelic_home.type},message:"must be string,null"};if(vErrors === null){vErrors = [err20];}else {vErrors.push(err20);}errors++;}}if(coerced15 !== undefined){data16 = coerced15;if(data !== undefined){data["newrelic_home"] = coerced15;}}}}if(data.port !== undefined){let data17 = data.port;if(!((typeof data17 == "number") && (!(data17 % 1) && !isNaN(data17)))){let dataType16 = typeof data17;let coerced16 = undefined;if(!(coerced16 !== undefined)){if(dataType16 === "boolean" || data17 === null
                  || (dataType16 === "string" && data17 && data17 == +data17 && !(data17 % 1))){coerced16 = +data17;}else {const err21 = {instancePath:instancePath+"/port",schemaPath:"#/properties/port/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err21];}else {vErrors.push(err21);}errors++;}}if(coerced16 !== undefined){data17 = coerced16;if(data !== undefined){data["port"] = coerced16;}}}}if(data.primary_application_id !== undefined){let data18 = data.primary_application_id;if(((typeof data18 !== "string") && (!(typeof data18 == "number"))) && (data18 !== null)){let dataType17 = typeof data18;let coerced17 = undefined;if(!(coerced17 !== undefined)){if(dataType17 == "number" || dataType17 == "boolean"){coerced17 = "" + data18;}else if(data18 === null){coerced17 = "";}else if(dataType17 == "boolean" || data18 === null
                  || (dataType17 == "string" && data18 && data18 == +data18)){coerced17 = +data18;}else if(data18 === "" || data18 === 0 || data18 === false){coerced17 = null;}else {const err22 = {instancePath:instancePath+"/primary_application_id",schemaPath:"#/properties/primary_application_id/type",keyword:"type",params:{type: schema31.properties.primary_application_id.type},message:"must be string,number,null"};if(vErrors === null){vErrors = [err22];}else {vErrors.push(err22);}errors++;}}if(coerced17 !== undefined){data18 = coerced17;if(data !== undefined){data["primary_application_id"] = coerced17;}}}}if(data.proxy !== undefined){let data19 = data.proxy;if(typeof data19 !== "string"){let dataType18 = typeof data19;let coerced18 = undefined;if(!(coerced18 !== undefined)){if(dataType18 == "number" || dataType18 == "boolean"){coerced18 = "" + data19;}else if(data19 === null){coerced18 = "";}else {const err23 = {instancePath:instancePath+"/proxy",schemaPath:"#/properties/proxy/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err23];}else {vErrors.push(err23);}errors++;}}if(coerced18 !== undefined){data19 = coerced18;if(data !== undefined){data["proxy"] = coerced18;}}}}if(data.proxy_host !== undefined){let data20 = data.proxy_host;if(typeof data20 !== "string"){let dataType19 = typeof data20;let coerced19 = undefined;if(!(coerced19 !== undefined)){if(dataType19 == "number" || dataType19 == "boolean"){coerced19 = "" + data20;}else if(data20 === null){coerced19 = "";}else {const err24 = {instancePath:instancePath+"/proxy_host",schemaPath:"#/properties/proxy_host/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err24];}else {vErrors.push(err24);}errors++;}}if(coerced19 !== undefined){data20 = coerced19;if(data !== undefined){data["proxy_host"] = coerced19;}}}}if(data.proxy_pass !== undefined){let data21 = data.proxy_pass;if(typeof data21 !== "string"){let dataType20 = typeof data21;let coerced20 = undefined;if(!(coerced20 !== undefined)){if(dataType20 == "number" || dataType20 == "boolean"){coerced20 = "" + data21;}else if(data21 === null){coerced20 = "";}else {const err25 = {instancePath:instancePath+"/proxy_pass",schemaPath:"#/properties/proxy_pass/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err25];}else {vErrors.push(err25);}errors++;}}if(coerced20 !== undefined){data21 = coerced20;if(data !== undefined){data["proxy_pass"] = coerced20;}}}}if(data.proxy_port !== undefined){let data22 = data.proxy_port;if(typeof data22 !== "string"){let dataType21 = typeof data22;let coerced21 = undefined;if(!(coerced21 !== undefined)){if(dataType21 == "number" || dataType21 == "boolean"){coerced21 = "" + data22;}else if(data22 === null){coerced21 = "";}else {const err26 = {instancePath:instancePath+"/proxy_port",schemaPath:"#/properties/proxy_port/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err26];}else {vErrors.push(err26);}errors++;}}if(coerced21 !== undefined){data22 = coerced21;if(data !== undefined){data["proxy_port"] = coerced21;}}}}if(data.proxy_user !== undefined){let data23 = data.proxy_user;if(typeof data23 !== "string"){let dataType22 = typeof data23;let coerced22 = undefined;if(!(coerced22 !== undefined)){if(dataType22 == "number" || dataType22 == "boolean"){coerced22 = "" + data23;}else if(data23 === null){coerced22 = "";}else {const err27 = {instancePath:instancePath+"/proxy_user",schemaPath:"#/properties/proxy_user/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err27];}else {vErrors.push(err27);}errors++;}}if(coerced22 !== undefined){data23 = coerced22;if(data !== undefined){data["proxy_user"] = coerced22;}}}}if(data.ssl !== undefined){let data24 = data.ssl;if(typeof data24 !== "boolean"){let coerced23 = undefined;if(!(coerced23 !== undefined)){if(data24 === "false" || data24 === 0 || data24 === null){coerced23 = false;}else if(data24 === "true" || data24 === 1){coerced23 = true;}else {const err28 = {instancePath:instancePath+"/ssl",schemaPath:"#/properties/ssl/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err28];}else {vErrors.push(err28);}errors++;}}if(coerced23 !== undefined){data24 = coerced23;if(data !== undefined){data["ssl"] = coerced23;}}}if(true !== data24){const err29 = {instancePath:instancePath+"/ssl",schemaPath:"#/properties/ssl/const",keyword:"const",params:{allowedValue: true},message:"must be equal to constant"};if(vErrors === null){vErrors = [err29];}else {vErrors.push(err29);}errors++;}}if(data.trusted_account_key !== undefined){let data25 = data.trusted_account_key;if(((typeof data25 !== "string") && (!(typeof data25 == "number"))) && (data25 !== null)){let dataType24 = typeof data25;let coerced24 = undefined;if(!(coerced24 !== undefined)){if(dataType24 == "number" || dataType24 == "boolean"){coerced24 = "" + data25;}else if(data25 === null){coerced24 = "";}else if(dataType24 == "boolean" || data25 === null
                  || (dataType24 == "string" && data25 && data25 == +data25)){coerced24 = +data25;}else if(data25 === "" || data25 === 0 || data25 === false){coerced24 = null;}else {const err30 = {instancePath:instancePath+"/trusted_account_key",schemaPath:"#/properties/trusted_account_key/type",keyword:"type",params:{type: schema31.properties.trusted_account_key.type},message:"must be string,number,null"};if(vErrors === null){vErrors = [err30];}else {vErrors.push(err30);}errors++;}}if(coerced24 !== undefined){data25 = coerced24;if(data !== undefined){data["trusted_account_key"] = coerced24;}}}}if(data.agent_control !== undefined){let data26 = data.agent_control;if(data26 && typeof data26 == "object" && !Array.isArray(data26)){if(data26.enabled !== undefined){let data27 = data26.enabled;if(typeof data27 !== "boolean"){let coerced25 = undefined;if(!(coerced25 !== undefined)){if(data27 === "false" || data27 === 0 || data27 === null){coerced25 = false;}else if(data27 === "true" || data27 === 1){coerced25 = true;}else {const err31 = {instancePath:instancePath+"/agent_control/enabled",schemaPath:"agent-control.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err31];}else {vErrors.push(err31);}errors++;}}if(coerced25 !== undefined){data27 = coerced25;if(data26 !== undefined){data26["enabled"] = coerced25;}}}}if(data26.health !== undefined){let data28 = data26.health;if(data28 && typeof data28 == "object" && !Array.isArray(data28)){if(data28.delivery_location !== undefined){let data29 = data28.delivery_location;if(typeof data29 !== "string"){let dataType26 = typeof data29;let coerced26 = undefined;if(!(coerced26 !== undefined)){if(dataType26 == "number" || dataType26 == "boolean"){coerced26 = "" + data29;}else if(data29 === null){coerced26 = "";}else {const err32 = {instancePath:instancePath+"/agent_control/health/delivery_location",schemaPath:"agent-control.js/properties/health/properties/delivery_location/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err32];}else {vErrors.push(err32);}errors++;}}if(coerced26 !== undefined){data29 = coerced26;if(data28 !== undefined){data28["delivery_location"] = coerced26;}}}}if(data28.frequency !== undefined){let data30 = data28.frequency;if(!((typeof data30 == "number") && (!(data30 % 1) && !isNaN(data30)))){let dataType27 = typeof data30;let coerced27 = undefined;if(!(coerced27 !== undefined)){if(dataType27 === "boolean" || data30 === null
                  || (dataType27 === "string" && data30 && data30 == +data30 && !(data30 % 1))){coerced27 = +data30;}else {const err33 = {instancePath:instancePath+"/agent_control/health/frequency",schemaPath:"agent-control.js/properties/health/properties/frequency/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err33];}else {vErrors.push(err33);}errors++;}}if(coerced27 !== undefined){data30 = coerced27;if(data28 !== undefined){data28["frequency"] = coerced27;}}}}}else {const err34 = {instancePath:instancePath+"/agent_control/health",schemaPath:"agent-control.js/properties/health/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err34];}else {vErrors.push(err34);}errors++;}}}else {const err35 = {instancePath:instancePath+"/agent_control",schemaPath:"agent-control.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err35];}else {vErrors.push(err35);}errors++;}}if(data.ai_monitoring !== undefined){let data31 = data.ai_monitoring;if(data31 && typeof data31 == "object" && !Array.isArray(data31)){if(data31.enabled !== undefined){let data32 = data31.enabled;if(typeof data32 !== "boolean"){let coerced28 = undefined;if(!(coerced28 !== undefined)){if(data32 === "false" || data32 === 0 || data32 === null){coerced28 = false;}else if(data32 === "true" || data32 === 1){coerced28 = true;}else {const err36 = {instancePath:instancePath+"/ai_monitoring/enabled",schemaPath:"ai-monitoring.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err36];}else {vErrors.push(err36);}errors++;}}if(coerced28 !== undefined){data32 = coerced28;if(data31 !== undefined){data31["enabled"] = coerced28;}}}}if(data31.record_content !== undefined){let data33 = data31.record_content;if(data33 && typeof data33 == "object" && !Array.isArray(data33)){if(data33.enabled !== undefined){let data34 = data33.enabled;if(typeof data34 !== "boolean"){let coerced29 = undefined;if(!(coerced29 !== undefined)){if(data34 === "false" || data34 === 0 || data34 === null){coerced29 = false;}else if(data34 === "true" || data34 === 1){coerced29 = true;}else {const err37 = {instancePath:instancePath+"/ai_monitoring/record_content/enabled",schemaPath:"ai-monitoring.js/properties/record_content/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err37];}else {vErrors.push(err37);}errors++;}}if(coerced29 !== undefined){data34 = coerced29;if(data33 !== undefined){data33["enabled"] = coerced29;}}}}}else {const err38 = {instancePath:instancePath+"/ai_monitoring/record_content",schemaPath:"ai-monitoring.js/properties/record_content/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err38];}else {vErrors.push(err38);}errors++;}}if(data31.streaming !== undefined){let data35 = data31.streaming;if(data35 && typeof data35 == "object" && !Array.isArray(data35)){if(data35.enabled !== undefined){let data36 = data35.enabled;if(typeof data36 !== "boolean"){let coerced30 = undefined;if(!(coerced30 !== undefined)){if(data36 === "false" || data36 === 0 || data36 === null){coerced30 = false;}else if(data36 === "true" || data36 === 1){coerced30 = true;}else {const err39 = {instancePath:instancePath+"/ai_monitoring/streaming/enabled",schemaPath:"ai-monitoring.js/properties/streaming/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err39];}else {vErrors.push(err39);}errors++;}}if(coerced30 !== undefined){data36 = coerced30;if(data35 !== undefined){data35["enabled"] = coerced30;}}}}}else {const err40 = {instancePath:instancePath+"/ai_monitoring/streaming",schemaPath:"ai-monitoring.js/properties/streaming/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err40];}else {vErrors.push(err40);}errors++;}}}else {const err41 = {instancePath:instancePath+"/ai_monitoring",schemaPath:"ai-monitoring.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err41];}else {vErrors.push(err41);}errors++;}}if(data.api !== undefined){let data37 = data.api;if(data37 && typeof data37 == "object" && !Array.isArray(data37)){if(data37.custom_attributes_enabled !== undefined){let data38 = data37.custom_attributes_enabled;if(typeof data38 !== "boolean"){let coerced31 = undefined;if(!(coerced31 !== undefined)){if(data38 === "false" || data38 === 0 || data38 === null){coerced31 = false;}else if(data38 === "true" || data38 === 1){coerced31 = true;}else {const err42 = {instancePath:instancePath+"/api/custom_attributes_enabled",schemaPath:"api.js/properties/custom_attributes_enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err42];}else {vErrors.push(err42);}errors++;}}if(coerced31 !== undefined){data38 = coerced31;if(data37 !== undefined){data37["custom_attributes_enabled"] = coerced31;}}}}if(data37.custom_events_enabled !== undefined){let data39 = data37.custom_events_enabled;if(typeof data39 !== "boolean"){let coerced32 = undefined;if(!(coerced32 !== undefined)){if(data39 === "false" || data39 === 0 || data39 === null){coerced32 = false;}else if(data39 === "true" || data39 === 1){coerced32 = true;}else {const err43 = {instancePath:instancePath+"/api/custom_events_enabled",schemaPath:"api.js/properties/custom_events_enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err43];}else {vErrors.push(err43);}errors++;}}if(coerced32 !== undefined){data39 = coerced32;if(data37 !== undefined){data37["custom_events_enabled"] = coerced32;}}}}if(data37.notice_error_enabled !== undefined){let data40 = data37.notice_error_enabled;if(typeof data40 !== "boolean"){let coerced33 = undefined;if(!(coerced33 !== undefined)){if(data40 === "false" || data40 === 0 || data40 === null){coerced33 = false;}else if(data40 === "true" || data40 === 1){coerced33 = true;}else {const err44 = {instancePath:instancePath+"/api/notice_error_enabled",schemaPath:"api.js/properties/notice_error_enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err44];}else {vErrors.push(err44);}errors++;}}if(coerced33 !== undefined){data40 = coerced33;if(data37 !== undefined){data37["notice_error_enabled"] = coerced33;}}}}}else {const err45 = {instancePath:instancePath+"/api",schemaPath:"api.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err45];}else {vErrors.push(err45);}errors++;}}if(data.apollo_server !== undefined){let data41 = data.apollo_server;if(data41 && typeof data41 == "object" && !Array.isArray(data41)){if(data41.scalars !== undefined){let data42 = data41.scalars;if(typeof data42 !== "boolean"){let coerced34 = undefined;if(!(coerced34 !== undefined)){if(data42 === "false" || data42 === 0 || data42 === null){coerced34 = false;}else if(data42 === "true" || data42 === 1){coerced34 = true;}else {const err46 = {instancePath:instancePath+"/apollo_server/scalars",schemaPath:"apollo-server.js/properties/scalars/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err46];}else {vErrors.push(err46);}errors++;}}if(coerced34 !== undefined){data42 = coerced34;if(data41 !== undefined){data41["scalars"] = coerced34;}}}}if(data41.introspection_queries !== undefined){let data43 = data41.introspection_queries;if(typeof data43 !== "boolean"){let coerced35 = undefined;if(!(coerced35 !== undefined)){if(data43 === "false" || data43 === 0 || data43 === null){coerced35 = false;}else if(data43 === "true" || data43 === 1){coerced35 = true;}else {const err47 = {instancePath:instancePath+"/apollo_server/introspection_queries",schemaPath:"apollo-server.js/properties/introspection_queries/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err47];}else {vErrors.push(err47);}errors++;}}if(coerced35 !== undefined){data43 = coerced35;if(data41 !== undefined){data41["introspection_queries"] = coerced35;}}}}if(data41.service_definition_queries !== undefined){let data44 = data41.service_definition_queries;if(typeof data44 !== "boolean"){let coerced36 = undefined;if(!(coerced36 !== undefined)){if(data44 === "false" || data44 === 0 || data44 === null){coerced36 = false;}else if(data44 === "true" || data44 === 1){coerced36 = true;}else {const err48 = {instancePath:instancePath+"/apollo_server/service_definition_queries",schemaPath:"apollo-server.js/properties/service_definition_queries/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err48];}else {vErrors.push(err48);}errors++;}}if(coerced36 !== undefined){data44 = coerced36;if(data41 !== undefined){data41["service_definition_queries"] = coerced36;}}}}if(data41.health_check_queries !== undefined){let data45 = data41.health_check_queries;if(typeof data45 !== "boolean"){let coerced37 = undefined;if(!(coerced37 !== undefined)){if(data45 === "false" || data45 === 0 || data45 === null){coerced37 = false;}else if(data45 === "true" || data45 === 1){coerced37 = true;}else {const err49 = {instancePath:instancePath+"/apollo_server/health_check_queries",schemaPath:"apollo-server.js/properties/health_check_queries/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err49];}else {vErrors.push(err49);}errors++;}}if(coerced37 !== undefined){data45 = coerced37;if(data41 !== undefined){data41["health_check_queries"] = coerced37;}}}}if(data41.field_metrics !== undefined){let data46 = data41.field_metrics;if(typeof data46 !== "boolean"){let coerced38 = undefined;if(!(coerced38 !== undefined)){if(data46 === "false" || data46 === 0 || data46 === null){coerced38 = false;}else if(data46 === "true" || data46 === 1){coerced38 = true;}else {const err50 = {instancePath:instancePath+"/apollo_server/field_metrics",schemaPath:"apollo-server.js/properties/field_metrics/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err50];}else {vErrors.push(err50);}errors++;}}if(coerced38 !== undefined){data46 = coerced38;if(data41 !== undefined){data41["field_metrics"] = coerced38;}}}}}else {const err51 = {instancePath:instancePath+"/apollo_server",schemaPath:"apollo-server.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err51];}else {vErrors.push(err51);}errors++;}}if(data.application_logging !== undefined){let data47 = data.application_logging;if(data47 && typeof data47 == "object" && !Array.isArray(data47)){if(data47.enabled !== undefined){let data48 = data47.enabled;if(typeof data48 !== "boolean"){let coerced39 = undefined;if(!(coerced39 !== undefined)){if(data48 === "false" || data48 === 0 || data48 === null){coerced39 = false;}else if(data48 === "true" || data48 === 1){coerced39 = true;}else {const err52 = {instancePath:instancePath+"/application_logging/enabled",schemaPath:"application-logging.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err52];}else {vErrors.push(err52);}errors++;}}if(coerced39 !== undefined){data48 = coerced39;if(data47 !== undefined){data47["enabled"] = coerced39;}}}}if(data47.forwarding !== undefined){let data49 = data47.forwarding;if(data49 && typeof data49 == "object" && !Array.isArray(data49)){if(data49.enabled !== undefined){let data50 = data49.enabled;if(typeof data50 !== "boolean"){let coerced40 = undefined;if(!(coerced40 !== undefined)){if(data50 === "false" || data50 === 0 || data50 === null){coerced40 = false;}else if(data50 === "true" || data50 === 1){coerced40 = true;}else {const err53 = {instancePath:instancePath+"/application_logging/forwarding/enabled",schemaPath:"application-logging.js/properties/forwarding/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err53];}else {vErrors.push(err53);}errors++;}}if(coerced40 !== undefined){data50 = coerced40;if(data49 !== undefined){data49["enabled"] = coerced40;}}}}if(data49.max_samples_stored !== undefined){let data51 = data49.max_samples_stored;if(!((typeof data51 == "number") && (!(data51 % 1) && !isNaN(data51)))){let dataType41 = typeof data51;let coerced41 = undefined;if(!(coerced41 !== undefined)){if(dataType41 === "boolean" || data51 === null
                  || (dataType41 === "string" && data51 && data51 == +data51 && !(data51 % 1))){coerced41 = +data51;}else {const err54 = {instancePath:instancePath+"/application_logging/forwarding/max_samples_stored",schemaPath:"application-logging.js/properties/forwarding/properties/max_samples_stored/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err54];}else {vErrors.push(err54);}errors++;}}if(coerced41 !== undefined){data51 = coerced41;if(data49 !== undefined){data49["max_samples_stored"] = coerced41;}}}}if(data49.labels !== undefined){let data52 = data49.labels;if(data52 && typeof data52 == "object" && !Array.isArray(data52)){if(data52.enabled !== undefined){let data53 = data52.enabled;if(typeof data53 !== "boolean"){let coerced42 = undefined;if(!(coerced42 !== undefined)){if(data53 === "false" || data53 === 0 || data53 === null){coerced42 = false;}else if(data53 === "true" || data53 === 1){coerced42 = true;}else {const err55 = {instancePath:instancePath+"/application_logging/forwarding/labels/enabled",schemaPath:"application-logging.js/properties/forwarding/properties/labels/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err55];}else {vErrors.push(err55);}errors++;}}if(coerced42 !== undefined){data53 = coerced42;if(data52 !== undefined){data52["enabled"] = coerced42;}}}}if(data52.exclude !== undefined){let data54 = data52.exclude;if(Array.isArray(data54)){const len2 = data54.length;for(let i2=0; i2<len2; i2++){let data55 = data54[i2];if(typeof data55 !== "string"){let dataType43 = typeof data55;let coerced43 = undefined;if(!(coerced43 !== undefined)){if(dataType43 == "number" || dataType43 == "boolean"){coerced43 = "" + data55;}else if(data55 === null){coerced43 = "";}else {const err56 = {instancePath:instancePath+"/application_logging/forwarding/labels/exclude/" + i2,schemaPath:"application-logging.js/properties/forwarding/properties/labels/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err56];}else {vErrors.push(err56);}errors++;}}if(coerced43 !== undefined){data55 = coerced43;if(data54 !== undefined){data54[i2] = coerced43;}}}}}else {const err57 = {instancePath:instancePath+"/application_logging/forwarding/labels/exclude",schemaPath:"application-logging.js/properties/forwarding/properties/labels/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err57];}else {vErrors.push(err57);}errors++;}}}else {const err58 = {instancePath:instancePath+"/application_logging/forwarding/labels",schemaPath:"application-logging.js/properties/forwarding/properties/labels/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err58];}else {vErrors.push(err58);}errors++;}}}else {const err59 = {instancePath:instancePath+"/application_logging/forwarding",schemaPath:"application-logging.js/properties/forwarding/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err59];}else {vErrors.push(err59);}errors++;}}if(data47.metrics !== undefined){let data56 = data47.metrics;if(data56 && typeof data56 == "object" && !Array.isArray(data56)){if(data56.enabled !== undefined){let data57 = data56.enabled;if(typeof data57 !== "boolean"){let coerced44 = undefined;if(!(coerced44 !== undefined)){if(data57 === "false" || data57 === 0 || data57 === null){coerced44 = false;}else if(data57 === "true" || data57 === 1){coerced44 = true;}else {const err60 = {instancePath:instancePath+"/application_logging/metrics/enabled",schemaPath:"application-logging.js/properties/metrics/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err60];}else {vErrors.push(err60);}errors++;}}if(coerced44 !== undefined){data57 = coerced44;if(data56 !== undefined){data56["enabled"] = coerced44;}}}}}else {const err61 = {instancePath:instancePath+"/application_logging/metrics",schemaPath:"application-logging.js/properties/metrics/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err61];}else {vErrors.push(err61);}errors++;}}if(data47.local_decorating !== undefined){let data58 = data47.local_decorating;if(data58 && typeof data58 == "object" && !Array.isArray(data58)){if(data58.enabled !== undefined){let data59 = data58.enabled;if(typeof data59 !== "boolean"){let coerced45 = undefined;if(!(coerced45 !== undefined)){if(data59 === "false" || data59 === 0 || data59 === null){coerced45 = false;}else if(data59 === "true" || data59 === 1){coerced45 = true;}else {const err62 = {instancePath:instancePath+"/application_logging/local_decorating/enabled",schemaPath:"application-logging.js/properties/local_decorating/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err62];}else {vErrors.push(err62);}errors++;}}if(coerced45 !== undefined){data59 = coerced45;if(data58 !== undefined){data58["enabled"] = coerced45;}}}}}else {const err63 = {instancePath:instancePath+"/application_logging/local_decorating",schemaPath:"application-logging.js/properties/local_decorating/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err63];}else {vErrors.push(err63);}errors++;}}}else {const err64 = {instancePath:instancePath+"/application_logging",schemaPath:"application-logging.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err64];}else {vErrors.push(err64);}errors++;}}if(data.attributes !== undefined){let data60 = data.attributes;if(data60 && typeof data60 == "object" && !Array.isArray(data60)){if(data60.enabled !== undefined){let data61 = data60.enabled;if(typeof data61 !== "boolean"){let coerced46 = undefined;if(!(coerced46 !== undefined)){if(data61 === "false" || data61 === 0 || data61 === null){coerced46 = false;}else if(data61 === "true" || data61 === 1){coerced46 = true;}else {const err65 = {instancePath:instancePath+"/attributes/enabled",schemaPath:"attributes.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err65];}else {vErrors.push(err65);}errors++;}}if(coerced46 !== undefined){data61 = coerced46;if(data60 !== undefined){data60["enabled"] = coerced46;}}}}if(data60.value_size_limit !== undefined){let data62 = data60.value_size_limit;if(!((typeof data62 == "number") && (!(data62 % 1) && !isNaN(data62)))){let dataType47 = typeof data62;let coerced47 = undefined;if(!(coerced47 !== undefined)){if(dataType47 === "boolean" || data62 === null
                  || (dataType47 === "string" && data62 && data62 == +data62 && !(data62 % 1))){coerced47 = +data62;}else {const err66 = {instancePath:instancePath+"/attributes/value_size_limit",schemaPath:"attributes.js/properties/value_size_limit/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err66];}else {vErrors.push(err66);}errors++;}}if(coerced47 !== undefined){data62 = coerced47;if(data60 !== undefined){data60["value_size_limit"] = coerced47;}}}if(typeof data62 == "number"){if(data62 > 4096 || isNaN(data62)){const err67 = {instancePath:instancePath+"/attributes/value_size_limit",schemaPath:"attributes.js/properties/value_size_limit/maximum",keyword:"maximum",params:{comparison: "<=", limit: 4096},message:"must be <= 4096"};if(vErrors === null){vErrors = [err67];}else {vErrors.push(err67);}errors++;}}}if(data60.exclude !== undefined){let data63 = data60.exclude;if(Array.isArray(data63)){const len3 = data63.length;for(let i3=0; i3<len3; i3++){let data64 = data63[i3];if(typeof data64 !== "string"){let dataType48 = typeof data64;let coerced48 = undefined;if(!(coerced48 !== undefined)){if(dataType48 == "number" || dataType48 == "boolean"){coerced48 = "" + data64;}else if(data64 === null){coerced48 = "";}else {const err68 = {instancePath:instancePath+"/attributes/exclude/" + i3,schemaPath:"attributes.js/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err68];}else {vErrors.push(err68);}errors++;}}if(coerced48 !== undefined){data64 = coerced48;if(data63 !== undefined){data63[i3] = coerced48;}}}}}else {const err69 = {instancePath:instancePath+"/attributes/exclude",schemaPath:"attributes.js/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err69];}else {vErrors.push(err69);}errors++;}}if(data60.include !== undefined){let data65 = data60.include;if(Array.isArray(data65)){const len4 = data65.length;for(let i4=0; i4<len4; i4++){let data66 = data65[i4];if(typeof data66 !== "string"){let dataType49 = typeof data66;let coerced49 = undefined;if(!(coerced49 !== undefined)){if(dataType49 == "number" || dataType49 == "boolean"){coerced49 = "" + data66;}else if(data66 === null){coerced49 = "";}else {const err70 = {instancePath:instancePath+"/attributes/include/" + i4,schemaPath:"attributes.js/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err70];}else {vErrors.push(err70);}errors++;}}if(coerced49 !== undefined){data66 = coerced49;if(data65 !== undefined){data65[i4] = coerced49;}}}}}else {const err71 = {instancePath:instancePath+"/attributes/include",schemaPath:"attributes.js/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err71];}else {vErrors.push(err71);}errors++;}}if(data60.include_enabled !== undefined){let data67 = data60.include_enabled;if(typeof data67 !== "boolean"){let coerced50 = undefined;if(!(coerced50 !== undefined)){if(data67 === "false" || data67 === 0 || data67 === null){coerced50 = false;}else if(data67 === "true" || data67 === 1){coerced50 = true;}else {const err72 = {instancePath:instancePath+"/attributes/include_enabled",schemaPath:"attributes.js/properties/include_enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err72];}else {vErrors.push(err72);}errors++;}}if(coerced50 !== undefined){data67 = coerced50;if(data60 !== undefined){data60["include_enabled"] = coerced50;}}}}if(data60.filter_cache_limit !== undefined){let data68 = data60.filter_cache_limit;if(!((typeof data68 == "number") && (!(data68 % 1) && !isNaN(data68)))){let dataType51 = typeof data68;let coerced51 = undefined;if(!(coerced51 !== undefined)){if(dataType51 === "boolean" || data68 === null
                  || (dataType51 === "string" && data68 && data68 == +data68 && !(data68 % 1))){coerced51 = +data68;}else {const err73 = {instancePath:instancePath+"/attributes/filter_cache_limit",schemaPath:"attributes.js/properties/filter_cache_limit/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err73];}else {vErrors.push(err73);}errors++;}}if(coerced51 !== undefined){data68 = coerced51;if(data60 !== undefined){data60["filter_cache_limit"] = coerced51;}}}}}else {const err74 = {instancePath:instancePath+"/attributes",schemaPath:"attributes.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err74];}else {vErrors.push(err74);}errors++;}}if(data.audit_log !== undefined){let data69 = data.audit_log;if(data69 && typeof data69 == "object" && !Array.isArray(data69)){if(data69.enabled !== undefined){let data70 = data69.enabled;if(typeof data70 !== "boolean"){let coerced52 = undefined;if(!(coerced52 !== undefined)){if(data70 === "false" || data70 === 0 || data70 === null){coerced52 = false;}else if(data70 === "true" || data70 === 1){coerced52 = true;}else {const err75 = {instancePath:instancePath+"/audit_log/enabled",schemaPath:"audit-log.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err75];}else {vErrors.push(err75);}errors++;}}if(coerced52 !== undefined){data70 = coerced52;if(data69 !== undefined){data69["enabled"] = coerced52;}}}}if(data69.endpoints !== undefined){let data71 = data69.endpoints;if(Array.isArray(data71)){const len5 = data71.length;for(let i5=0; i5<len5; i5++){let data72 = data71[i5];if(typeof data72 !== "string"){let dataType53 = typeof data72;let coerced53 = undefined;if(!(coerced53 !== undefined)){if(dataType53 == "number" || dataType53 == "boolean"){coerced53 = "" + data72;}else if(data72 === null){coerced53 = "";}else {const err76 = {instancePath:instancePath+"/audit_log/endpoints/" + i5,schemaPath:"audit-log.js/properties/endpoints/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err76];}else {vErrors.push(err76);}errors++;}}if(coerced53 !== undefined){data72 = coerced53;if(data71 !== undefined){data71[i5] = coerced53;}}}}}else {const err77 = {instancePath:instancePath+"/audit_log/endpoints",schemaPath:"audit-log.js/properties/endpoints/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err77];}else {vErrors.push(err77);}errors++;}}}else {const err78 = {instancePath:instancePath+"/audit_log",schemaPath:"audit-log.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err78];}else {vErrors.push(err78);}errors++;}}if(data.browser_monitoring !== undefined){let data73 = data.browser_monitoring;if(data73 && typeof data73 == "object" && !Array.isArray(data73)){if(data73.attributes !== undefined){let data74 = data73.attributes;if(data74 && typeof data74 == "object" && !Array.isArray(data74)){if(data74.enabled !== undefined){let data75 = data74.enabled;if(typeof data75 !== "boolean"){let coerced54 = undefined;if(!(coerced54 !== undefined)){if(data75 === "false" || data75 === 0 || data75 === null){coerced54 = false;}else if(data75 === "true" || data75 === 1){coerced54 = true;}else {const err79 = {instancePath:instancePath+"/browser_monitoring/attributes/enabled",schemaPath:"browser-monitoring.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err79];}else {vErrors.push(err79);}errors++;}}if(coerced54 !== undefined){data75 = coerced54;if(data74 !== undefined){data74["enabled"] = coerced54;}}}}if(data74.exclude !== undefined){let data76 = data74.exclude;if(Array.isArray(data76)){const len6 = data76.length;for(let i6=0; i6<len6; i6++){let data77 = data76[i6];if(typeof data77 !== "string"){let dataType55 = typeof data77;let coerced55 = undefined;if(!(coerced55 !== undefined)){if(dataType55 == "number" || dataType55 == "boolean"){coerced55 = "" + data77;}else if(data77 === null){coerced55 = "";}else {const err80 = {instancePath:instancePath+"/browser_monitoring/attributes/exclude/" + i6,schemaPath:"browser-monitoring.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err80];}else {vErrors.push(err80);}errors++;}}if(coerced55 !== undefined){data77 = coerced55;if(data76 !== undefined){data76[i6] = coerced55;}}}}}else {const err81 = {instancePath:instancePath+"/browser_monitoring/attributes/exclude",schemaPath:"browser-monitoring.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err81];}else {vErrors.push(err81);}errors++;}}if(data74.include !== undefined){let data78 = data74.include;if(Array.isArray(data78)){const len7 = data78.length;for(let i7=0; i7<len7; i7++){let data79 = data78[i7];if(typeof data79 !== "string"){let dataType56 = typeof data79;let coerced56 = undefined;if(!(coerced56 !== undefined)){if(dataType56 == "number" || dataType56 == "boolean"){coerced56 = "" + data79;}else if(data79 === null){coerced56 = "";}else {const err82 = {instancePath:instancePath+"/browser_monitoring/attributes/include/" + i7,schemaPath:"browser-monitoring.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err82];}else {vErrors.push(err82);}errors++;}}if(coerced56 !== undefined){data79 = coerced56;if(data78 !== undefined){data78[i7] = coerced56;}}}}}else {const err83 = {instancePath:instancePath+"/browser_monitoring/attributes/include",schemaPath:"browser-monitoring.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err83];}else {vErrors.push(err83);}errors++;}}}else {const err84 = {instancePath:instancePath+"/browser_monitoring/attributes",schemaPath:"browser-monitoring.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err84];}else {vErrors.push(err84);}errors++;}}if(data73.enable !== undefined){let data80 = data73.enable;if(typeof data80 !== "boolean"){let coerced57 = undefined;if(!(coerced57 !== undefined)){if(data80 === "false" || data80 === 0 || data80 === null){coerced57 = false;}else if(data80 === "true" || data80 === 1){coerced57 = true;}else {const err85 = {instancePath:instancePath+"/browser_monitoring/enable",schemaPath:"browser-monitoring.js/properties/enable/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err85];}else {vErrors.push(err85);}errors++;}}if(coerced57 !== undefined){data80 = coerced57;if(data73 !== undefined){data73["enable"] = coerced57;}}}}if(data73.debug !== undefined){let data81 = data73.debug;if(typeof data81 !== "boolean"){let coerced58 = undefined;if(!(coerced58 !== undefined)){if(data81 === "false" || data81 === 0 || data81 === null){coerced58 = false;}else if(data81 === "true" || data81 === 1){coerced58 = true;}else {const err86 = {instancePath:instancePath+"/browser_monitoring/debug",schemaPath:"browser-monitoring.js/properties/debug/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err86];}else {vErrors.push(err86);}errors++;}}if(coerced58 !== undefined){data81 = coerced58;if(data73 !== undefined){data73["debug"] = coerced58;}}}}if(data73.version !== undefined){let data82 = data73.version;if(typeof data82 !== "string"){let dataType59 = typeof data82;let coerced59 = undefined;if(!(coerced59 !== undefined)){if(dataType59 == "number" || dataType59 == "boolean"){coerced59 = "" + data82;}else if(data82 === null){coerced59 = "";}else {const err87 = {instancePath:instancePath+"/browser_monitoring/version",schemaPath:"browser-monitoring.js/properties/version/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err87];}else {vErrors.push(err87);}errors++;}}if(coerced59 !== undefined){data82 = coerced59;if(data73 !== undefined){data73["version"] = coerced59;}}}}}else {const err88 = {instancePath:instancePath+"/browser_monitoring",schemaPath:"browser-monitoring.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err88];}else {vErrors.push(err88);}errors++;}}if(data.cloud !== undefined){let data83 = data.cloud;if(data83 && typeof data83 == "object" && !Array.isArray(data83)){if(data83.aws !== undefined){let data84 = data83.aws;if(data84 && typeof data84 == "object" && !Array.isArray(data84)){if(data84.account_id !== undefined){let data85 = data84.account_id;if(!((typeof data85 == "number") && (!(data85 % 1) && !isNaN(data85)))){let dataType60 = typeof data85;let coerced60 = undefined;if(!(coerced60 !== undefined)){if(dataType60 === "boolean" || data85 === null
                  || (dataType60 === "string" && data85 && data85 == +data85 && !(data85 % 1))){coerced60 = +data85;}else {const err89 = {instancePath:instancePath+"/cloud/aws/account_id",schemaPath:"cloud.js/properties/aws/properties/account_id/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err89];}else {vErrors.push(err89);}errors++;}}if(coerced60 !== undefined){data85 = coerced60;if(data84 !== undefined){data84["account_id"] = coerced60;}}}}}else {const err90 = {instancePath:instancePath+"/cloud/aws",schemaPath:"cloud.js/properties/aws/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err90];}else {vErrors.push(err90);}errors++;}}}else {const err91 = {instancePath:instancePath+"/cloud",schemaPath:"cloud.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err91];}else {vErrors.push(err91);}errors++;}}if(data.code_level_metrics !== undefined){let data86 = data.code_level_metrics;if(data86 && typeof data86 == "object" && !Array.isArray(data86)){if(data86.enabled !== undefined){let data87 = data86.enabled;if(typeof data87 !== "boolean"){let coerced61 = undefined;if(!(coerced61 !== undefined)){if(data87 === "false" || data87 === 0 || data87 === null){coerced61 = false;}else if(data87 === "true" || data87 === 1){coerced61 = true;}else {const err92 = {instancePath:instancePath+"/code_level_metrics/enabled",schemaPath:"code-level-metrics.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err92];}else {vErrors.push(err92);}errors++;}}if(coerced61 !== undefined){data87 = coerced61;if(data86 !== undefined){data86["enabled"] = coerced61;}}}}}else {const err93 = {instancePath:instancePath+"/code_level_metrics",schemaPath:"code-level-metrics.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err93];}else {vErrors.push(err93);}errors++;}}if(data.custom_insights_events !== undefined){let data88 = data.custom_insights_events;if(data88 && typeof data88 == "object" && !Array.isArray(data88)){if(data88.enabled !== undefined){let data89 = data88.enabled;if(typeof data89 !== "boolean"){let coerced62 = undefined;if(!(coerced62 !== undefined)){if(data89 === "false" || data89 === 0 || data89 === null){coerced62 = false;}else if(data89 === "true" || data89 === 1){coerced62 = true;}else {const err94 = {instancePath:instancePath+"/custom_insights_events/enabled",schemaPath:"custom-insights-events.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err94];}else {vErrors.push(err94);}errors++;}}if(coerced62 !== undefined){data89 = coerced62;if(data88 !== undefined){data88["enabled"] = coerced62;}}}}if(data88.max_samples_stored !== undefined){let data90 = data88.max_samples_stored;if(!((typeof data90 == "number") && (!(data90 % 1) && !isNaN(data90)))){let dataType63 = typeof data90;let coerced63 = undefined;if(!(coerced63 !== undefined)){if(dataType63 === "boolean" || data90 === null
                  || (dataType63 === "string" && data90 && data90 == +data90 && !(data90 % 1))){coerced63 = +data90;}else {const err95 = {instancePath:instancePath+"/custom_insights_events/max_samples_stored",schemaPath:"custom-insights-events.js/properties/max_samples_stored/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err95];}else {vErrors.push(err95);}errors++;}}if(coerced63 !== undefined){data90 = coerced63;if(data88 !== undefined){data88["max_samples_stored"] = coerced63;}}}}}else {const err96 = {instancePath:instancePath+"/custom_insights_events",schemaPath:"custom-insights-events.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err96];}else {vErrors.push(err96);}errors++;}}if(data.datastore_tracer !== undefined){let data91 = data.datastore_tracer;if(data91 && typeof data91 == "object" && !Array.isArray(data91)){if(data91.instance_reporting !== undefined){let data92 = data91.instance_reporting;if(data92 && typeof data92 == "object" && !Array.isArray(data92)){if(data92.enabled !== undefined){let data93 = data92.enabled;if(typeof data93 !== "boolean"){let coerced64 = undefined;if(!(coerced64 !== undefined)){if(data93 === "false" || data93 === 0 || data93 === null){coerced64 = false;}else if(data93 === "true" || data93 === 1){coerced64 = true;}else {const err97 = {instancePath:instancePath+"/datastore_tracer/instance_reporting/enabled",schemaPath:"datastore-tracer.js/properties/instance_reporting/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err97];}else {vErrors.push(err97);}errors++;}}if(coerced64 !== undefined){data93 = coerced64;if(data92 !== undefined){data92["enabled"] = coerced64;}}}}}else {const err98 = {instancePath:instancePath+"/datastore_tracer/instance_reporting",schemaPath:"datastore-tracer.js/properties/instance_reporting/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err98];}else {vErrors.push(err98);}errors++;}}if(data91.database_name_reporting !== undefined){let data94 = data91.database_name_reporting;if(data94 && typeof data94 == "object" && !Array.isArray(data94)){if(data94.enabled !== undefined){let data95 = data94.enabled;if(typeof data95 !== "boolean"){let coerced65 = undefined;if(!(coerced65 !== undefined)){if(data95 === "false" || data95 === 0 || data95 === null){coerced65 = false;}else if(data95 === "true" || data95 === 1){coerced65 = true;}else {const err99 = {instancePath:instancePath+"/datastore_tracer/database_name_reporting/enabled",schemaPath:"datastore-tracer.js/properties/database_name_reporting/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err99];}else {vErrors.push(err99);}errors++;}}if(coerced65 !== undefined){data95 = coerced65;if(data94 !== undefined){data94["enabled"] = coerced65;}}}}}else {const err100 = {instancePath:instancePath+"/datastore_tracer/database_name_reporting",schemaPath:"datastore-tracer.js/properties/database_name_reporting/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err100];}else {vErrors.push(err100);}errors++;}}}else {const err101 = {instancePath:instancePath+"/datastore_tracer",schemaPath:"datastore-tracer.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err101];}else {vErrors.push(err101);}errors++;}}if(data.distributed_tracing !== undefined){let data96 = data.distributed_tracing;if(data96 && typeof data96 == "object" && !Array.isArray(data96)){if(data96.enabled !== undefined){let data97 = data96.enabled;if(typeof data97 !== "boolean"){let coerced66 = undefined;if(!(coerced66 !== undefined)){if(data97 === "false" || data97 === 0 || data97 === null){coerced66 = false;}else if(data97 === "true" || data97 === 1){coerced66 = true;}else {const err102 = {instancePath:instancePath+"/distributed_tracing/enabled",schemaPath:"distributed-tracing.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err102];}else {vErrors.push(err102);}errors++;}}if(coerced66 !== undefined){data97 = coerced66;if(data96 !== undefined){data96["enabled"] = coerced66;}}}}if(data96.exclude_newrelic_header !== undefined){let data98 = data96.exclude_newrelic_header;if(typeof data98 !== "boolean"){let coerced67 = undefined;if(!(coerced67 !== undefined)){if(data98 === "false" || data98 === 0 || data98 === null){coerced67 = false;}else if(data98 === "true" || data98 === 1){coerced67 = true;}else {const err103 = {instancePath:instancePath+"/distributed_tracing/exclude_newrelic_header",schemaPath:"distributed-tracing.js/properties/exclude_newrelic_header/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err103];}else {vErrors.push(err103);}errors++;}}if(coerced67 !== undefined){data98 = coerced67;if(data96 !== undefined){data96["exclude_newrelic_header"] = coerced67;}}}}if(data96.sampler !== undefined){let data99 = data96.sampler;if(data99 && typeof data99 == "object" && !Array.isArray(data99)){if(data99.root !== undefined){let data100 = data99.root;const _errs249 = errors;let valid57 = false;let passing2 = null;const _errs250 = errors;if(typeof data100 !== "string"){let dataType68 = typeof data100;let coerced68 = undefined;if(!(coerced68 !== undefined)){if(dataType68 == "number" || dataType68 == "boolean"){coerced68 = "" + data100;}else if(data100 === null){coerced68 = "";}else {const err104 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err104];}else {vErrors.push(err104);}errors++;}}if(coerced68 !== undefined){data100 = coerced68;if(data99 !== undefined){data99["root"] = coerced68;}}}if(!(((data100 === "always_on") || (data100 === "always_off")) || (data100 === "adaptive"))){const err105 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.root.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err105];}else {vErrors.push(err105);}errors++;}var _valid2 = _errs250 === errors;if(_valid2){valid57 = true;passing2 = 0;}const _errs252 = errors;if(data100 && typeof data100 == "object" && !Array.isArray(data100)){if(data100.trace_id_ratio_based === undefined){const err106 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err106];}else {vErrors.push(err106);}errors++;}if(data100.trace_id_ratio_based !== undefined){let data101 = data100.trace_id_ratio_based;if(data101 && typeof data101 == "object" && !Array.isArray(data101)){if(data101.ratio === undefined){const err107 = {instancePath:instancePath+"/distributed_tracing/sampler/root/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err107];}else {vErrors.push(err107);}errors++;}if(data101.ratio !== undefined){let data102 = data101.ratio;if(!(typeof data102 == "number")){let dataType69 = typeof data102;let coerced69 = undefined;if(!(coerced69 !== undefined)){if(dataType69 == "boolean" || data102 === null
                  || (dataType69 == "string" && data102 && data102 == +data102)){coerced69 = +data102;}else {const err108 = {instancePath:instancePath+"/distributed_tracing/sampler/root/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err108];}else {vErrors.push(err108);}errors++;}}if(coerced69 !== undefined){data102 = coerced69;if(data101 !== undefined){data101["ratio"] = coerced69;}}}}}else {const err109 = {instancePath:instancePath+"/distributed_tracing/sampler/root/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err109];}else {vErrors.push(err109);}errors++;}}}else {const err110 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err110];}else {vErrors.push(err110);}errors++;}var _valid2 = _errs252 === errors;if(_valid2 && valid57){valid57 = false;passing2 = [passing2, 1];}else {if(_valid2){valid57 = true;passing2 = 1;var props0 = true;}const _errs260 = errors;if(data100 && typeof data100 == "object" && !Array.isArray(data100)){if(data100.adaptive === undefined){const err111 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err111];}else {vErrors.push(err111);}errors++;}if(data100.adaptive !== undefined){let data103 = data100.adaptive;if(data103 && typeof data103 == "object" && !Array.isArray(data103)){if(data103.sampling_target !== undefined){let data104 = data103.sampling_target;if(!((typeof data104 == "number") && (!(data104 % 1) && !isNaN(data104)))){let dataType70 = typeof data104;let coerced70 = undefined;if(!(coerced70 !== undefined)){if(dataType70 === "boolean" || data104 === null
                  || (dataType70 === "string" && data104 && data104 == +data104 && !(data104 % 1))){coerced70 = +data104;}else {const err112 = {instancePath:instancePath+"/distributed_tracing/sampler/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err112];}else {vErrors.push(err112);}errors++;}}if(coerced70 !== undefined){data104 = coerced70;if(data103 !== undefined){data103["sampling_target"] = coerced70;}}}if(typeof data104 == "number"){if(data104 > 120 || isNaN(data104)){const err113 = {instancePath:instancePath+"/distributed_tracing/sampler/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err113];}else {vErrors.push(err113);}errors++;}if(data104 < 1 || isNaN(data104)){const err114 = {instancePath:instancePath+"/distributed_tracing/sampler/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err114];}else {vErrors.push(err114);}errors++;}}}}else {const err115 = {instancePath:instancePath+"/distributed_tracing/sampler/root/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err115];}else {vErrors.push(err115);}errors++;}}}else {const err116 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err116];}else {vErrors.push(err116);}errors++;}var _valid2 = _errs260 === errors;if(_valid2 && valid57){valid57 = false;passing2 = [passing2, 2];}else {if(_valid2){valid57 = true;passing2 = 2;if(props0 !== true){props0 = true;}}}}if(!valid57){const err117 = {instancePath:instancePath+"/distributed_tracing/sampler/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/root/oneOf",keyword:"oneOf",params:{passingSchemas: passing2},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err117];}else {vErrors.push(err117);}errors++;}else {errors = _errs249;if(vErrors !== null){if(_errs249){vErrors.length = _errs249;}else {vErrors = null;}}}}if(data99.remote_parent_sampled !== undefined){let data105 = data99.remote_parent_sampled;const _errs269 = errors;let valid62 = false;let passing3 = null;const _errs270 = errors;if(typeof data105 !== "string"){let dataType71 = typeof data105;let coerced71 = undefined;if(!(coerced71 !== undefined)){if(dataType71 == "number" || dataType71 == "boolean"){coerced71 = "" + data105;}else if(data105 === null){coerced71 = "";}else {const err118 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err118];}else {vErrors.push(err118);}errors++;}}if(coerced71 !== undefined){data105 = coerced71;if(data99 !== undefined){data99["remote_parent_sampled"] = coerced71;}}}if(!(((data105 === "always_on") || (data105 === "always_off")) || (data105 === "adaptive"))){const err119 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.remote_parent_sampled.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err119];}else {vErrors.push(err119);}errors++;}var _valid3 = _errs270 === errors;if(_valid3){valid62 = true;passing3 = 0;}const _errs272 = errors;if(data105 && typeof data105 == "object" && !Array.isArray(data105)){if(data105.trace_id_ratio_based === undefined){const err120 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err120];}else {vErrors.push(err120);}errors++;}if(data105.trace_id_ratio_based !== undefined){let data106 = data105.trace_id_ratio_based;if(data106 && typeof data106 == "object" && !Array.isArray(data106)){if(data106.ratio === undefined){const err121 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err121];}else {vErrors.push(err121);}errors++;}if(data106.ratio !== undefined){let data107 = data106.ratio;if(!(typeof data107 == "number")){let dataType72 = typeof data107;let coerced72 = undefined;if(!(coerced72 !== undefined)){if(dataType72 == "boolean" || data107 === null
                  || (dataType72 == "string" && data107 && data107 == +data107)){coerced72 = +data107;}else {const err122 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err122];}else {vErrors.push(err122);}errors++;}}if(coerced72 !== undefined){data107 = coerced72;if(data106 !== undefined){data106["ratio"] = coerced72;}}}}}else {const err123 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err123];}else {vErrors.push(err123);}errors++;}}}else {const err124 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err124];}else {vErrors.push(err124);}errors++;}var _valid3 = _errs272 === errors;if(_valid3 && valid62){valid62 = false;passing3 = [passing3, 1];}else {if(_valid3){valid62 = true;passing3 = 1;var props1 = true;}const _errs280 = errors;if(data105 && typeof data105 == "object" && !Array.isArray(data105)){if(data105.adaptive === undefined){const err125 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err125];}else {vErrors.push(err125);}errors++;}if(data105.adaptive !== undefined){let data108 = data105.adaptive;if(data108 && typeof data108 == "object" && !Array.isArray(data108)){if(data108.sampling_target !== undefined){let data109 = data108.sampling_target;if(!((typeof data109 == "number") && (!(data109 % 1) && !isNaN(data109)))){let dataType73 = typeof data109;let coerced73 = undefined;if(!(coerced73 !== undefined)){if(dataType73 === "boolean" || data109 === null
                  || (dataType73 === "string" && data109 && data109 == +data109 && !(data109 % 1))){coerced73 = +data109;}else {const err126 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err126];}else {vErrors.push(err126);}errors++;}}if(coerced73 !== undefined){data109 = coerced73;if(data108 !== undefined){data108["sampling_target"] = coerced73;}}}if(typeof data109 == "number"){if(data109 > 120 || isNaN(data109)){const err127 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err127];}else {vErrors.push(err127);}errors++;}if(data109 < 1 || isNaN(data109)){const err128 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err128];}else {vErrors.push(err128);}errors++;}}}}else {const err129 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err129];}else {vErrors.push(err129);}errors++;}}}else {const err130 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err130];}else {vErrors.push(err130);}errors++;}var _valid3 = _errs280 === errors;if(_valid3 && valid62){valid62 = false;passing3 = [passing3, 2];}else {if(_valid3){valid62 = true;passing3 = 2;if(props1 !== true){props1 = true;}}}}if(!valid62){const err131 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_sampled/oneOf",keyword:"oneOf",params:{passingSchemas: passing3},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err131];}else {vErrors.push(err131);}errors++;}else {errors = _errs269;if(vErrors !== null){if(_errs269){vErrors.length = _errs269;}else {vErrors = null;}}}}if(data99.remote_parent_not_sampled !== undefined){let data110 = data99.remote_parent_not_sampled;const _errs289 = errors;let valid67 = false;let passing4 = null;const _errs290 = errors;if(typeof data110 !== "string"){let dataType74 = typeof data110;let coerced74 = undefined;if(!(coerced74 !== undefined)){if(dataType74 == "number" || dataType74 == "boolean"){coerced74 = "" + data110;}else if(data110 === null){coerced74 = "";}else {const err132 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err132];}else {vErrors.push(err132);}errors++;}}if(coerced74 !== undefined){data110 = coerced74;if(data99 !== undefined){data99["remote_parent_not_sampled"] = coerced74;}}}if(!(((data110 === "always_on") || (data110 === "always_off")) || (data110 === "adaptive"))){const err133 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.remote_parent_not_sampled.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err133];}else {vErrors.push(err133);}errors++;}var _valid4 = _errs290 === errors;if(_valid4){valid67 = true;passing4 = 0;}const _errs292 = errors;if(data110 && typeof data110 == "object" && !Array.isArray(data110)){if(data110.trace_id_ratio_based === undefined){const err134 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err134];}else {vErrors.push(err134);}errors++;}if(data110.trace_id_ratio_based !== undefined){let data111 = data110.trace_id_ratio_based;if(data111 && typeof data111 == "object" && !Array.isArray(data111)){if(data111.ratio === undefined){const err135 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err135];}else {vErrors.push(err135);}errors++;}if(data111.ratio !== undefined){let data112 = data111.ratio;if(!(typeof data112 == "number")){let dataType75 = typeof data112;let coerced75 = undefined;if(!(coerced75 !== undefined)){if(dataType75 == "boolean" || data112 === null
                  || (dataType75 == "string" && data112 && data112 == +data112)){coerced75 = +data112;}else {const err136 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err136];}else {vErrors.push(err136);}errors++;}}if(coerced75 !== undefined){data112 = coerced75;if(data111 !== undefined){data111["ratio"] = coerced75;}}}}}else {const err137 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err137];}else {vErrors.push(err137);}errors++;}}}else {const err138 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err138];}else {vErrors.push(err138);}errors++;}var _valid4 = _errs292 === errors;if(_valid4 && valid67){valid67 = false;passing4 = [passing4, 1];}else {if(_valid4){valid67 = true;passing4 = 1;var props2 = true;}const _errs300 = errors;if(data110 && typeof data110 == "object" && !Array.isArray(data110)){if(data110.adaptive === undefined){const err139 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err139];}else {vErrors.push(err139);}errors++;}if(data110.adaptive !== undefined){let data113 = data110.adaptive;if(data113 && typeof data113 == "object" && !Array.isArray(data113)){if(data113.sampling_target !== undefined){let data114 = data113.sampling_target;if(!((typeof data114 == "number") && (!(data114 % 1) && !isNaN(data114)))){let dataType76 = typeof data114;let coerced76 = undefined;if(!(coerced76 !== undefined)){if(dataType76 === "boolean" || data114 === null
                  || (dataType76 === "string" && data114 && data114 == +data114 && !(data114 % 1))){coerced76 = +data114;}else {const err140 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err140];}else {vErrors.push(err140);}errors++;}}if(coerced76 !== undefined){data114 = coerced76;if(data113 !== undefined){data113["sampling_target"] = coerced76;}}}if(typeof data114 == "number"){if(data114 > 120 || isNaN(data114)){const err141 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err141];}else {vErrors.push(err141);}errors++;}if(data114 < 1 || isNaN(data114)){const err142 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err142];}else {vErrors.push(err142);}errors++;}}}}else {const err143 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err143];}else {vErrors.push(err143);}errors++;}}}else {const err144 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err144];}else {vErrors.push(err144);}errors++;}var _valid4 = _errs300 === errors;if(_valid4 && valid67){valid67 = false;passing4 = [passing4, 2];}else {if(_valid4){valid67 = true;passing4 = 2;if(props2 !== true){props2 = true;}}}}if(!valid67){const err145 = {instancePath:instancePath+"/distributed_tracing/sampler/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/remote_parent_not_sampled/oneOf",keyword:"oneOf",params:{passingSchemas: passing4},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err145];}else {vErrors.push(err145);}errors++;}else {errors = _errs289;if(vErrors !== null){if(_errs289){vErrors.length = _errs289;}else {vErrors = null;}}}}if(data99.adaptive_sampling_target !== undefined){let data115 = data99.adaptive_sampling_target;if(!((typeof data115 == "number") && (!(data115 % 1) && !isNaN(data115)))){let dataType77 = typeof data115;let coerced77 = undefined;if(!(coerced77 !== undefined)){if(dataType77 === "boolean" || data115 === null
                  || (dataType77 === "string" && data115 && data115 == +data115 && !(data115 % 1))){coerced77 = +data115;}else {const err146 = {instancePath:instancePath+"/distributed_tracing/sampler/adaptive_sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/adaptive_sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err146];}else {vErrors.push(err146);}errors++;}}if(coerced77 !== undefined){data115 = coerced77;if(data99 !== undefined){data99["adaptive_sampling_target"] = coerced77;}}}if(typeof data115 == "number"){if(data115 > 120 || isNaN(data115)){const err147 = {instancePath:instancePath+"/distributed_tracing/sampler/adaptive_sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/adaptive_sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err147];}else {vErrors.push(err147);}errors++;}if(data115 < 1 || isNaN(data115)){const err148 = {instancePath:instancePath+"/distributed_tracing/sampler/adaptive_sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/adaptive_sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err148];}else {vErrors.push(err148);}errors++;}}}if(data99.full_granularity !== undefined){let data116 = data99.full_granularity;if(data116 && typeof data116 == "object" && !Array.isArray(data116)){if(data116.enabled !== undefined){let data117 = data116.enabled;if(typeof data117 !== "boolean"){let coerced78 = undefined;if(!(coerced78 !== undefined)){if(data117 === "false" || data117 === 0 || data117 === null){coerced78 = false;}else if(data117 === "true" || data117 === 1){coerced78 = true;}else {const err149 = {instancePath:instancePath+"/distributed_tracing/sampler/full_granularity/enabled",schemaPath:"distributed-tracing.js/properties/sampler/properties/full_granularity/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err149];}else {vErrors.push(err149);}errors++;}}if(coerced78 !== undefined){data117 = coerced78;if(data116 !== undefined){data116["enabled"] = coerced78;}}}}}else {const err150 = {instancePath:instancePath+"/distributed_tracing/sampler/full_granularity",schemaPath:"distributed-tracing.js/properties/sampler/properties/full_granularity/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err150];}else {vErrors.push(err150);}errors++;}}if(data99.partial_granularity !== undefined){let data118 = data99.partial_granularity;if(data118 && typeof data118 == "object" && !Array.isArray(data118)){if(data118.enabled !== undefined){let data119 = data118.enabled;if(typeof data119 !== "boolean"){let coerced79 = undefined;if(!(coerced79 !== undefined)){if(data119 === "false" || data119 === 0 || data119 === null){coerced79 = false;}else if(data119 === "true" || data119 === 1){coerced79 = true;}else {const err151 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/enabled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err151];}else {vErrors.push(err151);}errors++;}}if(coerced79 !== undefined){data119 = coerced79;if(data118 !== undefined){data118["enabled"] = coerced79;}}}}if(data118.type !== undefined){let data120 = data118.type;if(typeof data120 !== "string"){let dataType80 = typeof data120;let coerced80 = undefined;if(!(coerced80 !== undefined)){if(dataType80 == "number" || dataType80 == "boolean"){coerced80 = "" + data120;}else if(data120 === null){coerced80 = "";}else {const err152 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/type",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/type/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err152];}else {vErrors.push(err152);}errors++;}}if(coerced80 !== undefined){data120 = coerced80;if(data118 !== undefined){data118["type"] = coerced80;}}}if(!(((data120 === "compact") || (data120 === "essential")) || (data120 === "reduced"))){const err153 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/type",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/type/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.partial_granularity.properties.type.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err153];}else {vErrors.push(err153);}errors++;}}if(data118.root !== undefined){let data121 = data118.root;const _errs323 = errors;let valid74 = false;let passing5 = null;const _errs324 = errors;if(typeof data121 !== "string"){let dataType81 = typeof data121;let coerced81 = undefined;if(!(coerced81 !== undefined)){if(dataType81 == "number" || dataType81 == "boolean"){coerced81 = "" + data121;}else if(data121 === null){coerced81 = "";}else {const err154 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err154];}else {vErrors.push(err154);}errors++;}}if(coerced81 !== undefined){data121 = coerced81;if(data118 !== undefined){data118["root"] = coerced81;}}}if(!(((data121 === "always_on") || (data121 === "always_off")) || (data121 === "adaptive"))){const err155 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.partial_granularity.properties.root.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err155];}else {vErrors.push(err155);}errors++;}var _valid5 = _errs324 === errors;if(_valid5){valid74 = true;passing5 = 0;}const _errs326 = errors;if(data121 && typeof data121 == "object" && !Array.isArray(data121)){if(data121.trace_id_ratio_based === undefined){const err156 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err156];}else {vErrors.push(err156);}errors++;}if(data121.trace_id_ratio_based !== undefined){let data122 = data121.trace_id_ratio_based;if(data122 && typeof data122 == "object" && !Array.isArray(data122)){if(data122.ratio === undefined){const err157 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err157];}else {vErrors.push(err157);}errors++;}if(data122.ratio !== undefined){let data123 = data122.ratio;if(!(typeof data123 == "number")){let dataType82 = typeof data123;let coerced82 = undefined;if(!(coerced82 !== undefined)){if(dataType82 == "boolean" || data123 === null
                  || (dataType82 == "string" && data123 && data123 == +data123)){coerced82 = +data123;}else {const err158 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err158];}else {vErrors.push(err158);}errors++;}}if(coerced82 !== undefined){data123 = coerced82;if(data122 !== undefined){data122["ratio"] = coerced82;}}}}}else {const err159 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err159];}else {vErrors.push(err159);}errors++;}}}else {const err160 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err160];}else {vErrors.push(err160);}errors++;}var _valid5 = _errs326 === errors;if(_valid5 && valid74){valid74 = false;passing5 = [passing5, 1];}else {if(_valid5){valid74 = true;passing5 = 1;var props3 = true;}const _errs334 = errors;if(data121 && typeof data121 == "object" && !Array.isArray(data121)){if(data121.adaptive === undefined){const err161 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err161];}else {vErrors.push(err161);}errors++;}if(data121.adaptive !== undefined){let data124 = data121.adaptive;if(data124 && typeof data124 == "object" && !Array.isArray(data124)){if(data124.sampling_target !== undefined){let data125 = data124.sampling_target;if(!((typeof data125 == "number") && (!(data125 % 1) && !isNaN(data125)))){let dataType83 = typeof data125;let coerced83 = undefined;if(!(coerced83 !== undefined)){if(dataType83 === "boolean" || data125 === null
                  || (dataType83 === "string" && data125 && data125 == +data125 && !(data125 % 1))){coerced83 = +data125;}else {const err162 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err162];}else {vErrors.push(err162);}errors++;}}if(coerced83 !== undefined){data125 = coerced83;if(data124 !== undefined){data124["sampling_target"] = coerced83;}}}if(typeof data125 == "number"){if(data125 > 120 || isNaN(data125)){const err163 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err163];}else {vErrors.push(err163);}errors++;}if(data125 < 1 || isNaN(data125)){const err164 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err164];}else {vErrors.push(err164);}errors++;}}}}else {const err165 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err165];}else {vErrors.push(err165);}errors++;}}}else {const err166 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err166];}else {vErrors.push(err166);}errors++;}var _valid5 = _errs334 === errors;if(_valid5 && valid74){valid74 = false;passing5 = [passing5, 2];}else {if(_valid5){valid74 = true;passing5 = 2;if(props3 !== true){props3 = true;}}}}if(!valid74){const err167 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/root",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/root/oneOf",keyword:"oneOf",params:{passingSchemas: passing5},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err167];}else {vErrors.push(err167);}errors++;}else {errors = _errs323;if(vErrors !== null){if(_errs323){vErrors.length = _errs323;}else {vErrors = null;}}}}if(data118.remote_parent_sampled !== undefined){let data126 = data118.remote_parent_sampled;const _errs343 = errors;let valid79 = false;let passing6 = null;const _errs344 = errors;if(typeof data126 !== "string"){let dataType84 = typeof data126;let coerced84 = undefined;if(!(coerced84 !== undefined)){if(dataType84 == "number" || dataType84 == "boolean"){coerced84 = "" + data126;}else if(data126 === null){coerced84 = "";}else {const err168 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err168];}else {vErrors.push(err168);}errors++;}}if(coerced84 !== undefined){data126 = coerced84;if(data118 !== undefined){data118["remote_parent_sampled"] = coerced84;}}}if(!(((data126 === "always_on") || (data126 === "always_off")) || (data126 === "adaptive"))){const err169 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.partial_granularity.properties.remote_parent_sampled.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err169];}else {vErrors.push(err169);}errors++;}var _valid6 = _errs344 === errors;if(_valid6){valid79 = true;passing6 = 0;}const _errs346 = errors;if(data126 && typeof data126 == "object" && !Array.isArray(data126)){if(data126.trace_id_ratio_based === undefined){const err170 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err170];}else {vErrors.push(err170);}errors++;}if(data126.trace_id_ratio_based !== undefined){let data127 = data126.trace_id_ratio_based;if(data127 && typeof data127 == "object" && !Array.isArray(data127)){if(data127.ratio === undefined){const err171 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err171];}else {vErrors.push(err171);}errors++;}if(data127.ratio !== undefined){let data128 = data127.ratio;if(!(typeof data128 == "number")){let dataType85 = typeof data128;let coerced85 = undefined;if(!(coerced85 !== undefined)){if(dataType85 == "boolean" || data128 === null
                  || (dataType85 == "string" && data128 && data128 == +data128)){coerced85 = +data128;}else {const err172 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err172];}else {vErrors.push(err172);}errors++;}}if(coerced85 !== undefined){data128 = coerced85;if(data127 !== undefined){data127["ratio"] = coerced85;}}}}}else {const err173 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err173];}else {vErrors.push(err173);}errors++;}}}else {const err174 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err174];}else {vErrors.push(err174);}errors++;}var _valid6 = _errs346 === errors;if(_valid6 && valid79){valid79 = false;passing6 = [passing6, 1];}else {if(_valid6){valid79 = true;passing6 = 1;var props4 = true;}const _errs354 = errors;if(data126 && typeof data126 == "object" && !Array.isArray(data126)){if(data126.adaptive === undefined){const err175 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err175];}else {vErrors.push(err175);}errors++;}if(data126.adaptive !== undefined){let data129 = data126.adaptive;if(data129 && typeof data129 == "object" && !Array.isArray(data129)){if(data129.sampling_target !== undefined){let data130 = data129.sampling_target;if(!((typeof data130 == "number") && (!(data130 % 1) && !isNaN(data130)))){let dataType86 = typeof data130;let coerced86 = undefined;if(!(coerced86 !== undefined)){if(dataType86 === "boolean" || data130 === null
                  || (dataType86 === "string" && data130 && data130 == +data130 && !(data130 % 1))){coerced86 = +data130;}else {const err176 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err176];}else {vErrors.push(err176);}errors++;}}if(coerced86 !== undefined){data130 = coerced86;if(data129 !== undefined){data129["sampling_target"] = coerced86;}}}if(typeof data130 == "number"){if(data130 > 120 || isNaN(data130)){const err177 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err177];}else {vErrors.push(err177);}errors++;}if(data130 < 1 || isNaN(data130)){const err178 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err178];}else {vErrors.push(err178);}errors++;}}}}else {const err179 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err179];}else {vErrors.push(err179);}errors++;}}}else {const err180 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err180];}else {vErrors.push(err180);}errors++;}var _valid6 = _errs354 === errors;if(_valid6 && valid79){valid79 = false;passing6 = [passing6, 2];}else {if(_valid6){valid79 = true;passing6 = 2;if(props4 !== true){props4 = true;}}}}if(!valid79){const err181 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_sampled/oneOf",keyword:"oneOf",params:{passingSchemas: passing6},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err181];}else {vErrors.push(err181);}errors++;}else {errors = _errs343;if(vErrors !== null){if(_errs343){vErrors.length = _errs343;}else {vErrors = null;}}}}if(data118.remote_parent_not_sampled !== undefined){let data131 = data118.remote_parent_not_sampled;const _errs363 = errors;let valid84 = false;let passing7 = null;const _errs364 = errors;if(typeof data131 !== "string"){let dataType87 = typeof data131;let coerced87 = undefined;if(!(coerced87 !== undefined)){if(dataType87 == "number" || dataType87 == "boolean"){coerced87 = "" + data131;}else if(data131 === null){coerced87 = "";}else {const err182 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err182];}else {vErrors.push(err182);}errors++;}}if(coerced87 !== undefined){data131 = coerced87;if(data118 !== undefined){data118["remote_parent_not_sampled"] = coerced87;}}}if(!(((data131 === "always_on") || (data131 === "always_off")) || (data131 === "adaptive"))){const err183 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/0/enum",keyword:"enum",params:{allowedValues: schema44.properties.sampler.properties.partial_granularity.properties.remote_parent_not_sampled.oneOf[0].enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err183];}else {vErrors.push(err183);}errors++;}var _valid7 = _errs364 === errors;if(_valid7){valid84 = true;passing7 = 0;}const _errs366 = errors;if(data131 && typeof data131 == "object" && !Array.isArray(data131)){if(data131.trace_id_ratio_based === undefined){const err184 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/1/required",keyword:"required",params:{missingProperty: "trace_id_ratio_based"},message:"must have required property '"+"trace_id_ratio_based"+"'"};if(vErrors === null){vErrors = [err184];}else {vErrors.push(err184);}errors++;}if(data131.trace_id_ratio_based !== undefined){let data132 = data131.trace_id_ratio_based;if(data132 && typeof data132 == "object" && !Array.isArray(data132)){if(data132.ratio === undefined){const err185 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/required",keyword:"required",params:{missingProperty: "ratio"},message:"must have required property '"+"ratio"+"'"};if(vErrors === null){vErrors = [err185];}else {vErrors.push(err185);}errors++;}if(data132.ratio !== undefined){let data133 = data132.ratio;if(!(typeof data133 == "number")){let dataType88 = typeof data133;let coerced88 = undefined;if(!(coerced88 !== undefined)){if(dataType88 == "boolean" || data133 === null
                  || (dataType88 == "string" && data133 && data133 == +data133)){coerced88 = +data133;}else {const err186 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/trace_id_ratio_based/ratio",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/properties/ratio/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err186];}else {vErrors.push(err186);}errors++;}}if(coerced88 !== undefined){data133 = coerced88;if(data132 !== undefined){data132["ratio"] = coerced88;}}}}}else {const err187 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/trace_id_ratio_based",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/1/properties/trace_id_ratio_based/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err187];}else {vErrors.push(err187);}errors++;}}}else {const err188 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err188];}else {vErrors.push(err188);}errors++;}var _valid7 = _errs366 === errors;if(_valid7 && valid84){valid84 = false;passing7 = [passing7, 1];}else {if(_valid7){valid84 = true;passing7 = 1;var props5 = true;}const _errs374 = errors;if(data131 && typeof data131 == "object" && !Array.isArray(data131)){if(data131.adaptive === undefined){const err189 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/required",keyword:"required",params:{missingProperty: "adaptive"},message:"must have required property '"+"adaptive"+"'"};if(vErrors === null){vErrors = [err189];}else {vErrors.push(err189);}errors++;}if(data131.adaptive !== undefined){let data134 = data131.adaptive;if(data134 && typeof data134 == "object" && !Array.isArray(data134)){if(data134.sampling_target !== undefined){let data135 = data134.sampling_target;if(!((typeof data135 == "number") && (!(data135 % 1) && !isNaN(data135)))){let dataType89 = typeof data135;let coerced89 = undefined;if(!(coerced89 !== undefined)){if(dataType89 === "boolean" || data135 === null
                  || (dataType89 === "string" && data135 && data135 == +data135 && !(data135 % 1))){coerced89 = +data135;}else {const err190 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err190];}else {vErrors.push(err190);}errors++;}}if(coerced89 !== undefined){data135 = coerced89;if(data134 !== undefined){data134["sampling_target"] = coerced89;}}}if(typeof data135 == "number"){if(data135 > 120 || isNaN(data135)){const err191 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/maximum",keyword:"maximum",params:{comparison: "<=", limit: 120},message:"must be <= 120"};if(vErrors === null){vErrors = [err191];}else {vErrors.push(err191);}errors++;}if(data135 < 1 || isNaN(data135)){const err192 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/adaptive/sampling_target",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/properties/sampling_target/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};if(vErrors === null){vErrors = [err192];}else {vErrors.push(err192);}errors++;}}}}else {const err193 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled/adaptive",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/properties/adaptive/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err193];}else {vErrors.push(err193);}errors++;}}}else {const err194 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err194];}else {vErrors.push(err194);}errors++;}var _valid7 = _errs374 === errors;if(_valid7 && valid84){valid84 = false;passing7 = [passing7, 2];}else {if(_valid7){valid84 = true;passing7 = 2;if(props5 !== true){props5 = true;}}}}if(!valid84){const err195 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity/remote_parent_not_sampled",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/properties/remote_parent_not_sampled/oneOf",keyword:"oneOf",params:{passingSchemas: passing7},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err195];}else {vErrors.push(err195);}errors++;}else {errors = _errs363;if(vErrors !== null){if(_errs363){vErrors.length = _errs363;}else {vErrors = null;}}}}}else {const err196 = {instancePath:instancePath+"/distributed_tracing/sampler/partial_granularity",schemaPath:"distributed-tracing.js/properties/sampler/properties/partial_granularity/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err196];}else {vErrors.push(err196);}errors++;}}}else {const err197 = {instancePath:instancePath+"/distributed_tracing/sampler",schemaPath:"distributed-tracing.js/properties/sampler/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err197];}else {vErrors.push(err197);}errors++;}}}else {const err198 = {instancePath:instancePath+"/distributed_tracing",schemaPath:"distributed-tracing.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err198];}else {vErrors.push(err198);}errors++;}}if(data.error_collector !== undefined){let data136 = data.error_collector;if(data136 && typeof data136 == "object" && !Array.isArray(data136)){if(data136.attributes !== undefined){let data137 = data136.attributes;if(data137 && typeof data137 == "object" && !Array.isArray(data137)){if(data137.enabled !== undefined){let data138 = data137.enabled;if(typeof data138 !== "boolean"){let coerced90 = undefined;if(!(coerced90 !== undefined)){if(data138 === "false" || data138 === 0 || data138 === null){coerced90 = false;}else if(data138 === "true" || data138 === 1){coerced90 = true;}else {const err199 = {instancePath:instancePath+"/error_collector/attributes/enabled",schemaPath:"error-collector.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err199];}else {vErrors.push(err199);}errors++;}}if(coerced90 !== undefined){data138 = coerced90;if(data137 !== undefined){data137["enabled"] = coerced90;}}}}if(data137.exclude !== undefined){let data139 = data137.exclude;if(Array.isArray(data139)){const len8 = data139.length;for(let i8=0; i8<len8; i8++){let data140 = data139[i8];if(typeof data140 !== "string"){let dataType91 = typeof data140;let coerced91 = undefined;if(!(coerced91 !== undefined)){if(dataType91 == "number" || dataType91 == "boolean"){coerced91 = "" + data140;}else if(data140 === null){coerced91 = "";}else {const err200 = {instancePath:instancePath+"/error_collector/attributes/exclude/" + i8,schemaPath:"error-collector.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err200];}else {vErrors.push(err200);}errors++;}}if(coerced91 !== undefined){data140 = coerced91;if(data139 !== undefined){data139[i8] = coerced91;}}}}}else {const err201 = {instancePath:instancePath+"/error_collector/attributes/exclude",schemaPath:"error-collector.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err201];}else {vErrors.push(err201);}errors++;}}if(data137.include !== undefined){let data141 = data137.include;if(Array.isArray(data141)){const len9 = data141.length;for(let i9=0; i9<len9; i9++){let data142 = data141[i9];if(typeof data142 !== "string"){let dataType92 = typeof data142;let coerced92 = undefined;if(!(coerced92 !== undefined)){if(dataType92 == "number" || dataType92 == "boolean"){coerced92 = "" + data142;}else if(data142 === null){coerced92 = "";}else {const err202 = {instancePath:instancePath+"/error_collector/attributes/include/" + i9,schemaPath:"error-collector.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err202];}else {vErrors.push(err202);}errors++;}}if(coerced92 !== undefined){data142 = coerced92;if(data141 !== undefined){data141[i9] = coerced92;}}}}}else {const err203 = {instancePath:instancePath+"/error_collector/attributes/include",schemaPath:"error-collector.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err203];}else {vErrors.push(err203);}errors++;}}}else {const err204 = {instancePath:instancePath+"/error_collector/attributes",schemaPath:"error-collector.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err204];}else {vErrors.push(err204);}errors++;}}if(data136.enabled !== undefined){let data143 = data136.enabled;if(typeof data143 !== "boolean"){let coerced93 = undefined;if(!(coerced93 !== undefined)){if(data143 === "false" || data143 === 0 || data143 === null){coerced93 = false;}else if(data143 === "true" || data143 === 1){coerced93 = true;}else {const err205 = {instancePath:instancePath+"/error_collector/enabled",schemaPath:"error-collector.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err205];}else {vErrors.push(err205);}errors++;}}if(coerced93 !== undefined){data143 = coerced93;if(data136 !== undefined){data136["enabled"] = coerced93;}}}}if(data136.ignore_status_codes !== undefined){let data144 = data136.ignore_status_codes;if(Array.isArray(data144)){const len10 = data144.length;for(let i10=0; i10<len10; i10++){let data145 = data144[i10];if(typeof data145 !== "string"){let dataType94 = typeof data145;let coerced94 = undefined;if(!(coerced94 !== undefined)){if(dataType94 == "number" || dataType94 == "boolean"){coerced94 = "" + data145;}else if(data145 === null){coerced94 = "";}else {const err206 = {instancePath:instancePath+"/error_collector/ignore_status_codes/" + i10,schemaPath:"error-collector.js/properties/ignore_status_codes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err206];}else {vErrors.push(err206);}errors++;}}if(coerced94 !== undefined){data145 = coerced94;if(data144 !== undefined){data144[i10] = coerced94;}}}}}else {const err207 = {instancePath:instancePath+"/error_collector/ignore_status_codes",schemaPath:"error-collector.js/properties/ignore_status_codes/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err207];}else {vErrors.push(err207);}errors++;}}if(data136.capture_events !== undefined){let data146 = data136.capture_events;if(typeof data146 !== "boolean"){let coerced95 = undefined;if(!(coerced95 !== undefined)){if(data146 === "false" || data146 === 0 || data146 === null){coerced95 = false;}else if(data146 === "true" || data146 === 1){coerced95 = true;}else {const err208 = {instancePath:instancePath+"/error_collector/capture_events",schemaPath:"error-collector.js/properties/capture_events/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err208];}else {vErrors.push(err208);}errors++;}}if(coerced95 !== undefined){data146 = coerced95;if(data136 !== undefined){data136["capture_events"] = coerced95;}}}}if(data136.max_event_samples_stored !== undefined){let data147 = data136.max_event_samples_stored;if(!((typeof data147 == "number") && (!(data147 % 1) && !isNaN(data147)))){let dataType96 = typeof data147;let coerced96 = undefined;if(!(coerced96 !== undefined)){if(dataType96 === "boolean" || data147 === null
                  || (dataType96 === "string" && data147 && data147 == +data147 && !(data147 % 1))){coerced96 = +data147;}else {const err209 = {instancePath:instancePath+"/error_collector/max_event_samples_stored",schemaPath:"error-collector.js/properties/max_event_samples_stored/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err209];}else {vErrors.push(err209);}errors++;}}if(coerced96 !== undefined){data147 = coerced96;if(data136 !== undefined){data136["max_event_samples_stored"] = coerced96;}}}}if(data136.expected_classes !== undefined){let data148 = data136.expected_classes;if(Array.isArray(data148)){const len11 = data148.length;for(let i11=0; i11<len11; i11++){let data149 = data148[i11];if(typeof data149 !== "string"){let dataType97 = typeof data149;let coerced97 = undefined;if(!(coerced97 !== undefined)){if(dataType97 == "number" || dataType97 == "boolean"){coerced97 = "" + data149;}else if(data149 === null){coerced97 = "";}else {const err210 = {instancePath:instancePath+"/error_collector/expected_classes/" + i11,schemaPath:"error-collector.js/properties/expected_classes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err210];}else {vErrors.push(err210);}errors++;}}if(coerced97 !== undefined){data149 = coerced97;if(data148 !== undefined){data148[i11] = coerced97;}}}}}else {const err211 = {instancePath:instancePath+"/error_collector/expected_classes",schemaPath:"error-collector.js/properties/expected_classes/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err211];}else {vErrors.push(err211);}errors++;}}if(data136.expected_messages !== undefined){let data150 = data136.expected_messages;if(data150 && typeof data150 == "object" && !Array.isArray(data150)){}else {const err212 = {instancePath:instancePath+"/error_collector/expected_messages",schemaPath:"error-collector.js/properties/expected_messages/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err212];}else {vErrors.push(err212);}errors++;}}if(data136.expected_status_codes !== undefined){let data151 = data136.expected_status_codes;if(Array.isArray(data151)){const len12 = data151.length;for(let i12=0; i12<len12; i12++){let data152 = data151[i12];if(typeof data152 !== "string"){let dataType98 = typeof data152;let coerced98 = undefined;if(!(coerced98 !== undefined)){if(dataType98 == "number" || dataType98 == "boolean"){coerced98 = "" + data152;}else if(data152 === null){coerced98 = "";}else {const err213 = {instancePath:instancePath+"/error_collector/expected_status_codes/" + i12,schemaPath:"error-collector.js/properties/expected_status_codes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err213];}else {vErrors.push(err213);}errors++;}}if(coerced98 !== undefined){data152 = coerced98;if(data151 !== undefined){data151[i12] = coerced98;}}}}}else {const err214 = {instancePath:instancePath+"/error_collector/expected_status_codes",schemaPath:"error-collector.js/properties/expected_status_codes/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err214];}else {vErrors.push(err214);}errors++;}}if(data136.ignore_classes !== undefined){let data153 = data136.ignore_classes;if(Array.isArray(data153)){const len13 = data153.length;for(let i13=0; i13<len13; i13++){let data154 = data153[i13];if(typeof data154 !== "string"){let dataType99 = typeof data154;let coerced99 = undefined;if(!(coerced99 !== undefined)){if(dataType99 == "number" || dataType99 == "boolean"){coerced99 = "" + data154;}else if(data154 === null){coerced99 = "";}else {const err215 = {instancePath:instancePath+"/error_collector/ignore_classes/" + i13,schemaPath:"error-collector.js/properties/ignore_classes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err215];}else {vErrors.push(err215);}errors++;}}if(coerced99 !== undefined){data154 = coerced99;if(data153 !== undefined){data153[i13] = coerced99;}}}}}else {const err216 = {instancePath:instancePath+"/error_collector/ignore_classes",schemaPath:"error-collector.js/properties/ignore_classes/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err216];}else {vErrors.push(err216);}errors++;}}if(data136.ignore_messages !== undefined){let data155 = data136.ignore_messages;if(data155 && typeof data155 == "object" && !Array.isArray(data155)){}else {const err217 = {instancePath:instancePath+"/error_collector/ignore_messages",schemaPath:"error-collector.js/properties/ignore_messages/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err217];}else {vErrors.push(err217);}errors++;}}}else {const err218 = {instancePath:instancePath+"/error_collector",schemaPath:"error-collector.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err218];}else {vErrors.push(err218);}errors++;}}if(data.grpc !== undefined){let data156 = data.grpc;if(data156 && typeof data156 == "object" && !Array.isArray(data156)){if(data156.record_errors !== undefined){let data157 = data156.record_errors;if(typeof data157 !== "boolean"){let coerced100 = undefined;if(!(coerced100 !== undefined)){if(data157 === "false" || data157 === 0 || data157 === null){coerced100 = false;}else if(data157 === "true" || data157 === 1){coerced100 = true;}else {const err219 = {instancePath:instancePath+"/grpc/record_errors",schemaPath:"grpc.js/properties/record_errors/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err219];}else {vErrors.push(err219);}errors++;}}if(coerced100 !== undefined){data157 = coerced100;if(data156 !== undefined){data156["record_errors"] = coerced100;}}}}if(data156.ignore_status_codes !== undefined){let data158 = data156.ignore_status_codes;if(Array.isArray(data158)){const len14 = data158.length;for(let i14=0; i14<len14; i14++){let data159 = data158[i14];if(typeof data159 !== "string"){let dataType101 = typeof data159;let coerced101 = undefined;if(!(coerced101 !== undefined)){if(dataType101 == "number" || dataType101 == "boolean"){coerced101 = "" + data159;}else if(data159 === null){coerced101 = "";}else {const err220 = {instancePath:instancePath+"/grpc/ignore_status_codes/" + i14,schemaPath:"grpc.js/properties/ignore_status_codes/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err220];}else {vErrors.push(err220);}errors++;}}if(coerced101 !== undefined){data159 = coerced101;if(data158 !== undefined){data158[i14] = coerced101;}}}}}else {const err221 = {instancePath:instancePath+"/grpc/ignore_status_codes",schemaPath:"grpc.js/properties/ignore_status_codes/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err221];}else {vErrors.push(err221);}errors++;}}}else {const err222 = {instancePath:instancePath+"/grpc",schemaPath:"grpc.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err222];}else {vErrors.push(err222);}errors++;}}if(data.heroku !== undefined){let data160 = data.heroku;if(data160 && typeof data160 == "object" && !Array.isArray(data160)){if(data160.use_dyno_names !== undefined){let data161 = data160.use_dyno_names;if(typeof data161 !== "boolean"){let coerced102 = undefined;if(!(coerced102 !== undefined)){if(data161 === "false" || data161 === 0 || data161 === null){coerced102 = false;}else if(data161 === "true" || data161 === 1){coerced102 = true;}else {const err223 = {instancePath:instancePath+"/heroku/use_dyno_names",schemaPath:"heroku.js/properties/use_dyno_names/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err223];}else {vErrors.push(err223);}errors++;}}if(coerced102 !== undefined){data161 = coerced102;if(data160 !== undefined){data160["use_dyno_names"] = coerced102;}}}}}else {const err224 = {instancePath:instancePath+"/heroku",schemaPath:"heroku.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err224];}else {vErrors.push(err224);}errors++;}}if(data.infinite_tracing !== undefined){let data162 = data.infinite_tracing;if(data162 && typeof data162 == "object" && !Array.isArray(data162)){if(data162.trace_observer !== undefined){let data163 = data162.trace_observer;if(data163 && typeof data163 == "object" && !Array.isArray(data163)){if(data163.host !== undefined){let data164 = data163.host;if(typeof data164 !== "string"){let dataType103 = typeof data164;let coerced103 = undefined;if(!(coerced103 !== undefined)){if(dataType103 == "number" || dataType103 == "boolean"){coerced103 = "" + data164;}else if(data164 === null){coerced103 = "";}else {const err225 = {instancePath:instancePath+"/infinite_tracing/trace_observer/host",schemaPath:"infinite-tracing.js/properties/trace_observer/properties/host/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err225];}else {vErrors.push(err225);}errors++;}}if(coerced103 !== undefined){data164 = coerced103;if(data163 !== undefined){data163["host"] = coerced103;}}}}if(data163.port !== undefined){let data165 = data163.port;if(!((typeof data165 == "number") && (!(data165 % 1) && !isNaN(data165)))){let dataType104 = typeof data165;let coerced104 = undefined;if(!(coerced104 !== undefined)){if(dataType104 === "boolean" || data165 === null
                  || (dataType104 === "string" && data165 && data165 == +data165 && !(data165 % 1))){coerced104 = +data165;}else {const err226 = {instancePath:instancePath+"/infinite_tracing/trace_observer/port",schemaPath:"infinite-tracing.js/properties/trace_observer/properties/port/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err226];}else {vErrors.push(err226);}errors++;}}if(coerced104 !== undefined){data165 = coerced104;if(data163 !== undefined){data163["port"] = coerced104;}}}}if(data163.insecure !== undefined){let data166 = data163.insecure;if(typeof data166 !== "boolean"){let coerced105 = undefined;if(!(coerced105 !== undefined)){if(data166 === "false" || data166 === 0 || data166 === null){coerced105 = false;}else if(data166 === "true" || data166 === 1){coerced105 = true;}else {const err227 = {instancePath:instancePath+"/infinite_tracing/trace_observer/insecure",schemaPath:"infinite-tracing.js/properties/trace_observer/properties/insecure/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err227];}else {vErrors.push(err227);}errors++;}}if(coerced105 !== undefined){data166 = coerced105;if(data163 !== undefined){data163["insecure"] = coerced105;}}}}}else {const err228 = {instancePath:instancePath+"/infinite_tracing/trace_observer",schemaPath:"infinite-tracing.js/properties/trace_observer/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err228];}else {vErrors.push(err228);}errors++;}}if(data162.span_events !== undefined){let data167 = data162.span_events;if(data167 && typeof data167 == "object" && !Array.isArray(data167)){if(data167.queue_size !== undefined){let data168 = data167.queue_size;if(!((typeof data168 == "number") && (!(data168 % 1) && !isNaN(data168)))){let dataType106 = typeof data168;let coerced106 = undefined;if(!(coerced106 !== undefined)){if(dataType106 === "boolean" || data168 === null
                  || (dataType106 === "string" && data168 && data168 == +data168 && !(data168 % 1))){coerced106 = +data168;}else {const err229 = {instancePath:instancePath+"/infinite_tracing/span_events/queue_size",schemaPath:"infinite-tracing.js/properties/span_events/properties/queue_size/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err229];}else {vErrors.push(err229);}errors++;}}if(coerced106 !== undefined){data168 = coerced106;if(data167 !== undefined){data167["queue_size"] = coerced106;}}}}if(data167.batch_size !== undefined){let data169 = data167.batch_size;if(!((typeof data169 == "number") && (!(data169 % 1) && !isNaN(data169)))){let dataType107 = typeof data169;let coerced107 = undefined;if(!(coerced107 !== undefined)){if(dataType107 === "boolean" || data169 === null
                  || (dataType107 === "string" && data169 && data169 == +data169 && !(data169 % 1))){coerced107 = +data169;}else {const err230 = {instancePath:instancePath+"/infinite_tracing/span_events/batch_size",schemaPath:"infinite-tracing.js/properties/span_events/properties/batch_size/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err230];}else {vErrors.push(err230);}errors++;}}if(coerced107 !== undefined){data169 = coerced107;if(data167 !== undefined){data167["batch_size"] = coerced107;}}}}}else {const err231 = {instancePath:instancePath+"/infinite_tracing/span_events",schemaPath:"infinite-tracing.js/properties/span_events/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err231];}else {vErrors.push(err231);}errors++;}}if(data162.batching !== undefined){let data170 = data162.batching;if(typeof data170 !== "boolean"){let coerced108 = undefined;if(!(coerced108 !== undefined)){if(data170 === "false" || data170 === 0 || data170 === null){coerced108 = false;}else if(data170 === "true" || data170 === 1){coerced108 = true;}else {const err232 = {instancePath:instancePath+"/infinite_tracing/batching",schemaPath:"infinite-tracing.js/properties/batching/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err232];}else {vErrors.push(err232);}errors++;}}if(coerced108 !== undefined){data170 = coerced108;if(data162 !== undefined){data162["batching"] = coerced108;}}}}if(data162.compression !== undefined){let data171 = data162.compression;if(typeof data171 !== "boolean"){let coerced109 = undefined;if(!(coerced109 !== undefined)){if(data171 === "false" || data171 === 0 || data171 === null){coerced109 = false;}else if(data171 === "true" || data171 === 1){coerced109 = true;}else {const err233 = {instancePath:instancePath+"/infinite_tracing/compression",schemaPath:"infinite-tracing.js/properties/compression/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err233];}else {vErrors.push(err233);}errors++;}}if(coerced109 !== undefined){data171 = coerced109;if(data162 !== undefined){data162["compression"] = coerced109;}}}}}else {const err234 = {instancePath:instancePath+"/infinite_tracing",schemaPath:"infinite-tracing.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err234];}else {vErrors.push(err234);}errors++;}}if(data.instrumentation !== undefined){let data172 = data.instrumentation;if(data172 && typeof data172 == "object" && !Array.isArray(data172)){for(const key0 in data172){if(!(func1.call(schema49.properties, key0))){let data173 = data172[key0];if(data173 && typeof data173 == "object" && !Array.isArray(data173)){if(data173.enabled !== undefined){let data174 = data173.enabled;if(typeof data174 !== "boolean"){let coerced110 = undefined;if(!(coerced110 !== undefined)){if(data174 === "false" || data174 === 0 || data174 === null){coerced110 = false;}else if(data174 === "true" || data174 === 1){coerced110 = true;}else {const err235 = {instancePath:instancePath+"/instrumentation/" + key0.replace(/~/g, "~0").replace(/\//g, "~1")+"/enabled",schemaPath:"instrumentation.js/additionalProperties/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err235];}else {vErrors.push(err235);}errors++;}}if(coerced110 !== undefined){data174 = coerced110;if(data173 !== undefined){data173["enabled"] = coerced110;}}}}}else {const err236 = {instancePath:instancePath+"/instrumentation/" + key0.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"instrumentation.js/additionalProperties/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err236];}else {vErrors.push(err236);}errors++;}}}if(data172["@anthropic-ai/sdk"] !== undefined){let data175 = data172["@anthropic-ai/sdk"];if(data175 && typeof data175 == "object" && !Array.isArray(data175)){if(data175.enabled !== undefined){let data176 = data175.enabled;if(typeof data176 !== "boolean"){let coerced111 = undefined;if(!(coerced111 !== undefined)){if(data176 === "false" || data176 === 0 || data176 === null){coerced111 = false;}else if(data176 === "true" || data176 === 1){coerced111 = true;}else {const err237 = {instancePath:instancePath+"/instrumentation/@anthropic-ai~1sdk/enabled",schemaPath:"instrumentation.js/properties/%40anthropic-ai~1sdk/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err237];}else {vErrors.push(err237);}errors++;}}if(coerced111 !== undefined){data176 = coerced111;if(data175 !== undefined){data175["enabled"] = coerced111;}}}}}else {const err238 = {instancePath:instancePath+"/instrumentation/@anthropic-ai~1sdk",schemaPath:"instrumentation.js/properties/%40anthropic-ai~1sdk/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err238];}else {vErrors.push(err238);}errors++;}}if(data172["@apollo/server"] !== undefined){let data177 = data172["@apollo/server"];if(data177 && typeof data177 == "object" && !Array.isArray(data177)){if(data177.enabled !== undefined){let data178 = data177.enabled;if(typeof data178 !== "boolean"){let coerced112 = undefined;if(!(coerced112 !== undefined)){if(data178 === "false" || data178 === 0 || data178 === null){coerced112 = false;}else if(data178 === "true" || data178 === 1){coerced112 = true;}else {const err239 = {instancePath:instancePath+"/instrumentation/@apollo~1server/enabled",schemaPath:"instrumentation.js/properties/%40apollo~1server/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err239];}else {vErrors.push(err239);}errors++;}}if(coerced112 !== undefined){data178 = coerced112;if(data177 !== undefined){data177["enabled"] = coerced112;}}}}}else {const err240 = {instancePath:instancePath+"/instrumentation/@apollo~1server",schemaPath:"instrumentation.js/properties/%40apollo~1server/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err240];}else {vErrors.push(err240);}errors++;}}if(data172["@aws-sdk/smithy-client"] !== undefined){let data179 = data172["@aws-sdk/smithy-client"];if(data179 && typeof data179 == "object" && !Array.isArray(data179)){if(data179.enabled !== undefined){let data180 = data179.enabled;if(typeof data180 !== "boolean"){let coerced113 = undefined;if(!(coerced113 !== undefined)){if(data180 === "false" || data180 === 0 || data180 === null){coerced113 = false;}else if(data180 === "true" || data180 === 1){coerced113 = true;}else {const err241 = {instancePath:instancePath+"/instrumentation/@aws-sdk~1smithy-client/enabled",schemaPath:"instrumentation.js/properties/%40aws-sdk~1smithy-client/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err241];}else {vErrors.push(err241);}errors++;}}if(coerced113 !== undefined){data180 = coerced113;if(data179 !== undefined){data179["enabled"] = coerced113;}}}}}else {const err242 = {instancePath:instancePath+"/instrumentation/@aws-sdk~1smithy-client",schemaPath:"instrumentation.js/properties/%40aws-sdk~1smithy-client/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err242];}else {vErrors.push(err242);}errors++;}}if(data172["@azure/functions"] !== undefined){let data181 = data172["@azure/functions"];if(data181 && typeof data181 == "object" && !Array.isArray(data181)){if(data181.enabled !== undefined){let data182 = data181.enabled;if(typeof data182 !== "boolean"){let coerced114 = undefined;if(!(coerced114 !== undefined)){if(data182 === "false" || data182 === 0 || data182 === null){coerced114 = false;}else if(data182 === "true" || data182 === 1){coerced114 = true;}else {const err243 = {instancePath:instancePath+"/instrumentation/@azure~1functions/enabled",schemaPath:"instrumentation.js/properties/%40azure~1functions/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err243];}else {vErrors.push(err243);}errors++;}}if(coerced114 !== undefined){data182 = coerced114;if(data181 !== undefined){data181["enabled"] = coerced114;}}}}}else {const err244 = {instancePath:instancePath+"/instrumentation/@azure~1functions",schemaPath:"instrumentation.js/properties/%40azure~1functions/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err244];}else {vErrors.push(err244);}errors++;}}if(data172["@elastic/elasticsearch"] !== undefined){let data183 = data172["@elastic/elasticsearch"];if(data183 && typeof data183 == "object" && !Array.isArray(data183)){if(data183.enabled !== undefined){let data184 = data183.enabled;if(typeof data184 !== "boolean"){let coerced115 = undefined;if(!(coerced115 !== undefined)){if(data184 === "false" || data184 === 0 || data184 === null){coerced115 = false;}else if(data184 === "true" || data184 === 1){coerced115 = true;}else {const err245 = {instancePath:instancePath+"/instrumentation/@elastic~1elasticsearch/enabled",schemaPath:"instrumentation.js/properties/%40elastic~1elasticsearch/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err245];}else {vErrors.push(err245);}errors++;}}if(coerced115 !== undefined){data184 = coerced115;if(data183 !== undefined){data183["enabled"] = coerced115;}}}}}else {const err246 = {instancePath:instancePath+"/instrumentation/@elastic~1elasticsearch",schemaPath:"instrumentation.js/properties/%40elastic~1elasticsearch/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err246];}else {vErrors.push(err246);}errors++;}}if(data172["@elastic/transport"] !== undefined){let data185 = data172["@elastic/transport"];if(data185 && typeof data185 == "object" && !Array.isArray(data185)){if(data185.enabled !== undefined){let data186 = data185.enabled;if(typeof data186 !== "boolean"){let coerced116 = undefined;if(!(coerced116 !== undefined)){if(data186 === "false" || data186 === 0 || data186 === null){coerced116 = false;}else if(data186 === "true" || data186 === 1){coerced116 = true;}else {const err247 = {instancePath:instancePath+"/instrumentation/@elastic~1transport/enabled",schemaPath:"instrumentation.js/properties/%40elastic~1transport/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err247];}else {vErrors.push(err247);}errors++;}}if(coerced116 !== undefined){data186 = coerced116;if(data185 !== undefined){data185["enabled"] = coerced116;}}}}}else {const err248 = {instancePath:instancePath+"/instrumentation/@elastic~1transport",schemaPath:"instrumentation.js/properties/%40elastic~1transport/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err248];}else {vErrors.push(err248);}errors++;}}if(data172["@google/adk"] !== undefined){let data187 = data172["@google/adk"];if(data187 && typeof data187 == "object" && !Array.isArray(data187)){if(data187.enabled !== undefined){let data188 = data187.enabled;if(typeof data188 !== "boolean"){let coerced117 = undefined;if(!(coerced117 !== undefined)){if(data188 === "false" || data188 === 0 || data188 === null){coerced117 = false;}else if(data188 === "true" || data188 === 1){coerced117 = true;}else {const err249 = {instancePath:instancePath+"/instrumentation/@google~1adk/enabled",schemaPath:"instrumentation.js/properties/%40google~1adk/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err249];}else {vErrors.push(err249);}errors++;}}if(coerced117 !== undefined){data188 = coerced117;if(data187 !== undefined){data187["enabled"] = coerced117;}}}}}else {const err250 = {instancePath:instancePath+"/instrumentation/@google~1adk",schemaPath:"instrumentation.js/properties/%40google~1adk/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err250];}else {vErrors.push(err250);}errors++;}}if(data172["@google/genai"] !== undefined){let data189 = data172["@google/genai"];if(data189 && typeof data189 == "object" && !Array.isArray(data189)){if(data189.enabled !== undefined){let data190 = data189.enabled;if(typeof data190 !== "boolean"){let coerced118 = undefined;if(!(coerced118 !== undefined)){if(data190 === "false" || data190 === 0 || data190 === null){coerced118 = false;}else if(data190 === "true" || data190 === 1){coerced118 = true;}else {const err251 = {instancePath:instancePath+"/instrumentation/@google~1genai/enabled",schemaPath:"instrumentation.js/properties/%40google~1genai/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err251];}else {vErrors.push(err251);}errors++;}}if(coerced118 !== undefined){data190 = coerced118;if(data189 !== undefined){data189["enabled"] = coerced118;}}}}}else {const err252 = {instancePath:instancePath+"/instrumentation/@google~1genai",schemaPath:"instrumentation.js/properties/%40google~1genai/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err252];}else {vErrors.push(err252);}errors++;}}if(data172["@grpc/grpc-js"] !== undefined){let data191 = data172["@grpc/grpc-js"];if(data191 && typeof data191 == "object" && !Array.isArray(data191)){if(data191.enabled !== undefined){let data192 = data191.enabled;if(typeof data192 !== "boolean"){let coerced119 = undefined;if(!(coerced119 !== undefined)){if(data192 === "false" || data192 === 0 || data192 === null){coerced119 = false;}else if(data192 === "true" || data192 === 1){coerced119 = true;}else {const err253 = {instancePath:instancePath+"/instrumentation/@grpc~1grpc-js/enabled",schemaPath:"instrumentation.js/properties/%40grpc~1grpc-js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err253];}else {vErrors.push(err253);}errors++;}}if(coerced119 !== undefined){data192 = coerced119;if(data191 !== undefined){data191["enabled"] = coerced119;}}}}}else {const err254 = {instancePath:instancePath+"/instrumentation/@grpc~1grpc-js",schemaPath:"instrumentation.js/properties/%40grpc~1grpc-js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err254];}else {vErrors.push(err254);}errors++;}}if(data172["@hapi/hapi"] !== undefined){let data193 = data172["@hapi/hapi"];if(data193 && typeof data193 == "object" && !Array.isArray(data193)){if(data193.enabled !== undefined){let data194 = data193.enabled;if(typeof data194 !== "boolean"){let coerced120 = undefined;if(!(coerced120 !== undefined)){if(data194 === "false" || data194 === 0 || data194 === null){coerced120 = false;}else if(data194 === "true" || data194 === 1){coerced120 = true;}else {const err255 = {instancePath:instancePath+"/instrumentation/@hapi~1hapi/enabled",schemaPath:"instrumentation.js/properties/%40hapi~1hapi/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err255];}else {vErrors.push(err255);}errors++;}}if(coerced120 !== undefined){data194 = coerced120;if(data193 !== undefined){data193["enabled"] = coerced120;}}}}}else {const err256 = {instancePath:instancePath+"/instrumentation/@hapi~1hapi",schemaPath:"instrumentation.js/properties/%40hapi~1hapi/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err256];}else {vErrors.push(err256);}errors++;}}if(data172["@hapi/vision"] !== undefined){let data195 = data172["@hapi/vision"];if(data195 && typeof data195 == "object" && !Array.isArray(data195)){if(data195.enabled !== undefined){let data196 = data195.enabled;if(typeof data196 !== "boolean"){let coerced121 = undefined;if(!(coerced121 !== undefined)){if(data196 === "false" || data196 === 0 || data196 === null){coerced121 = false;}else if(data196 === "true" || data196 === 1){coerced121 = true;}else {const err257 = {instancePath:instancePath+"/instrumentation/@hapi~1vision/enabled",schemaPath:"instrumentation.js/properties/%40hapi~1vision/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err257];}else {vErrors.push(err257);}errors++;}}if(coerced121 !== undefined){data196 = coerced121;if(data195 !== undefined){data195["enabled"] = coerced121;}}}}}else {const err258 = {instancePath:instancePath+"/instrumentation/@hapi~1vision",schemaPath:"instrumentation.js/properties/%40hapi~1vision/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err258];}else {vErrors.push(err258);}errors++;}}if(data172["@langchain/core"] !== undefined){let data197 = data172["@langchain/core"];if(data197 && typeof data197 == "object" && !Array.isArray(data197)){if(data197.enabled !== undefined){let data198 = data197.enabled;if(typeof data198 !== "boolean"){let coerced122 = undefined;if(!(coerced122 !== undefined)){if(data198 === "false" || data198 === 0 || data198 === null){coerced122 = false;}else if(data198 === "true" || data198 === 1){coerced122 = true;}else {const err259 = {instancePath:instancePath+"/instrumentation/@langchain~1core/enabled",schemaPath:"instrumentation.js/properties/%40langchain~1core/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err259];}else {vErrors.push(err259);}errors++;}}if(coerced122 !== undefined){data198 = coerced122;if(data197 !== undefined){data197["enabled"] = coerced122;}}}}}else {const err260 = {instancePath:instancePath+"/instrumentation/@langchain~1core",schemaPath:"instrumentation.js/properties/%40langchain~1core/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err260];}else {vErrors.push(err260);}errors++;}}if(data172["@langchain/langgraph"] !== undefined){let data199 = data172["@langchain/langgraph"];if(data199 && typeof data199 == "object" && !Array.isArray(data199)){if(data199.enabled !== undefined){let data200 = data199.enabled;if(typeof data200 !== "boolean"){let coerced123 = undefined;if(!(coerced123 !== undefined)){if(data200 === "false" || data200 === 0 || data200 === null){coerced123 = false;}else if(data200 === "true" || data200 === 1){coerced123 = true;}else {const err261 = {instancePath:instancePath+"/instrumentation/@langchain~1langgraph/enabled",schemaPath:"instrumentation.js/properties/%40langchain~1langgraph/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err261];}else {vErrors.push(err261);}errors++;}}if(coerced123 !== undefined){data200 = coerced123;if(data199 !== undefined){data199["enabled"] = coerced123;}}}}}else {const err262 = {instancePath:instancePath+"/instrumentation/@langchain~1langgraph",schemaPath:"instrumentation.js/properties/%40langchain~1langgraph/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err262];}else {vErrors.push(err262);}errors++;}}if(data172["@modelcontextprotocol/sdk"] !== undefined){let data201 = data172["@modelcontextprotocol/sdk"];if(data201 && typeof data201 == "object" && !Array.isArray(data201)){if(data201.enabled !== undefined){let data202 = data201.enabled;if(typeof data202 !== "boolean"){let coerced124 = undefined;if(!(coerced124 !== undefined)){if(data202 === "false" || data202 === 0 || data202 === null){coerced124 = false;}else if(data202 === "true" || data202 === 1){coerced124 = true;}else {const err263 = {instancePath:instancePath+"/instrumentation/@modelcontextprotocol~1sdk/enabled",schemaPath:"instrumentation.js/properties/%40modelcontextprotocol~1sdk/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err263];}else {vErrors.push(err263);}errors++;}}if(coerced124 !== undefined){data202 = coerced124;if(data201 !== undefined){data201["enabled"] = coerced124;}}}}}else {const err264 = {instancePath:instancePath+"/instrumentation/@modelcontextprotocol~1sdk",schemaPath:"instrumentation.js/properties/%40modelcontextprotocol~1sdk/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err264];}else {vErrors.push(err264);}errors++;}}if(data172["@modelcontextprotocol/sdk/client/index.js"] !== undefined){let data203 = data172["@modelcontextprotocol/sdk/client/index.js"];if(data203 && typeof data203 == "object" && !Array.isArray(data203)){if(data203.enabled !== undefined){let data204 = data203.enabled;if(typeof data204 !== "boolean"){let coerced125 = undefined;if(!(coerced125 !== undefined)){if(data204 === "false" || data204 === 0 || data204 === null){coerced125 = false;}else if(data204 === "true" || data204 === 1){coerced125 = true;}else {const err265 = {instancePath:instancePath+"/instrumentation/@modelcontextprotocol~1sdk~1client~1index.js/enabled",schemaPath:"instrumentation.js/properties/%40modelcontextprotocol~1sdk~1client~1index.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err265];}else {vErrors.push(err265);}errors++;}}if(coerced125 !== undefined){data204 = coerced125;if(data203 !== undefined){data203["enabled"] = coerced125;}}}}}else {const err266 = {instancePath:instancePath+"/instrumentation/@modelcontextprotocol~1sdk~1client~1index.js",schemaPath:"instrumentation.js/properties/%40modelcontextprotocol~1sdk~1client~1index.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err266];}else {vErrors.push(err266);}errors++;}}if(data172["@nestjs/core"] !== undefined){let data205 = data172["@nestjs/core"];if(data205 && typeof data205 == "object" && !Array.isArray(data205)){if(data205.enabled !== undefined){let data206 = data205.enabled;if(typeof data206 !== "boolean"){let coerced126 = undefined;if(!(coerced126 !== undefined)){if(data206 === "false" || data206 === 0 || data206 === null){coerced126 = false;}else if(data206 === "true" || data206 === 1){coerced126 = true;}else {const err267 = {instancePath:instancePath+"/instrumentation/@nestjs~1core/enabled",schemaPath:"instrumentation.js/properties/%40nestjs~1core/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err267];}else {vErrors.push(err267);}errors++;}}if(coerced126 !== undefined){data206 = coerced126;if(data205 !== undefined){data205["enabled"] = coerced126;}}}}}else {const err268 = {instancePath:instancePath+"/instrumentation/@nestjs~1core",schemaPath:"instrumentation.js/properties/%40nestjs~1core/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err268];}else {vErrors.push(err268);}errors++;}}if(data172["@node-redis/client"] !== undefined){let data207 = data172["@node-redis/client"];if(data207 && typeof data207 == "object" && !Array.isArray(data207)){if(data207.enabled !== undefined){let data208 = data207.enabled;if(typeof data208 !== "boolean"){let coerced127 = undefined;if(!(coerced127 !== undefined)){if(data208 === "false" || data208 === 0 || data208 === null){coerced127 = false;}else if(data208 === "true" || data208 === 1){coerced127 = true;}else {const err269 = {instancePath:instancePath+"/instrumentation/@node-redis~1client/enabled",schemaPath:"instrumentation.js/properties/%40node-redis~1client/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err269];}else {vErrors.push(err269);}errors++;}}if(coerced127 !== undefined){data208 = coerced127;if(data207 !== undefined){data207["enabled"] = coerced127;}}}}}else {const err270 = {instancePath:instancePath+"/instrumentation/@node-redis~1client",schemaPath:"instrumentation.js/properties/%40node-redis~1client/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err270];}else {vErrors.push(err270);}errors++;}}if(data172["@opensearch-project/opensearch"] !== undefined){let data209 = data172["@opensearch-project/opensearch"];if(data209 && typeof data209 == "object" && !Array.isArray(data209)){if(data209.enabled !== undefined){let data210 = data209.enabled;if(typeof data210 !== "boolean"){let coerced128 = undefined;if(!(coerced128 !== undefined)){if(data210 === "false" || data210 === 0 || data210 === null){coerced128 = false;}else if(data210 === "true" || data210 === 1){coerced128 = true;}else {const err271 = {instancePath:instancePath+"/instrumentation/@opensearch-project~1opensearch/enabled",schemaPath:"instrumentation.js/properties/%40opensearch-project~1opensearch/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err271];}else {vErrors.push(err271);}errors++;}}if(coerced128 !== undefined){data210 = coerced128;if(data209 !== undefined){data209["enabled"] = coerced128;}}}}}else {const err272 = {instancePath:instancePath+"/instrumentation/@opensearch-project~1opensearch",schemaPath:"instrumentation.js/properties/%40opensearch-project~1opensearch/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err272];}else {vErrors.push(err272);}errors++;}}if(data172["@prisma/client"] !== undefined){let data211 = data172["@prisma/client"];if(data211 && typeof data211 == "object" && !Array.isArray(data211)){if(data211.enabled !== undefined){let data212 = data211.enabled;if(typeof data212 !== "boolean"){let coerced129 = undefined;if(!(coerced129 !== undefined)){if(data212 === "false" || data212 === 0 || data212 === null){coerced129 = false;}else if(data212 === "true" || data212 === 1){coerced129 = true;}else {const err273 = {instancePath:instancePath+"/instrumentation/@prisma~1client/enabled",schemaPath:"instrumentation.js/properties/%40prisma~1client/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err273];}else {vErrors.push(err273);}errors++;}}if(coerced129 !== undefined){data212 = coerced129;if(data211 !== undefined){data211["enabled"] = coerced129;}}}}}else {const err274 = {instancePath:instancePath+"/instrumentation/@prisma~1client",schemaPath:"instrumentation.js/properties/%40prisma~1client/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err274];}else {vErrors.push(err274);}errors++;}}if(data172["@redis/client"] !== undefined){let data213 = data172["@redis/client"];if(data213 && typeof data213 == "object" && !Array.isArray(data213)){if(data213.enabled !== undefined){let data214 = data213.enabled;if(typeof data214 !== "boolean"){let coerced130 = undefined;if(!(coerced130 !== undefined)){if(data214 === "false" || data214 === 0 || data214 === null){coerced130 = false;}else if(data214 === "true" || data214 === 1){coerced130 = true;}else {const err275 = {instancePath:instancePath+"/instrumentation/@redis~1client/enabled",schemaPath:"instrumentation.js/properties/%40redis~1client/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err275];}else {vErrors.push(err275);}errors++;}}if(coerced130 !== undefined){data214 = coerced130;if(data213 !== undefined){data213["enabled"] = coerced130;}}}}}else {const err276 = {instancePath:instancePath+"/instrumentation/@redis~1client",schemaPath:"instrumentation.js/properties/%40redis~1client/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err276];}else {vErrors.push(err276);}errors++;}}if(data172["@smithy/core"] !== undefined){let data215 = data172["@smithy/core"];if(data215 && typeof data215 == "object" && !Array.isArray(data215)){if(data215.enabled !== undefined){let data216 = data215.enabled;if(typeof data216 !== "boolean"){let coerced131 = undefined;if(!(coerced131 !== undefined)){if(data216 === "false" || data216 === 0 || data216 === null){coerced131 = false;}else if(data216 === "true" || data216 === 1){coerced131 = true;}else {const err277 = {instancePath:instancePath+"/instrumentation/@smithy~1core/enabled",schemaPath:"instrumentation.js/properties/%40smithy~1core/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err277];}else {vErrors.push(err277);}errors++;}}if(coerced131 !== undefined){data216 = coerced131;if(data215 !== undefined){data215["enabled"] = coerced131;}}}}}else {const err278 = {instancePath:instancePath+"/instrumentation/@smithy~1core",schemaPath:"instrumentation.js/properties/%40smithy~1core/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err278];}else {vErrors.push(err278);}errors++;}}if(data172["@smithy/smithy-client"] !== undefined){let data217 = data172["@smithy/smithy-client"];if(data217 && typeof data217 == "object" && !Array.isArray(data217)){if(data217.enabled !== undefined){let data218 = data217.enabled;if(typeof data218 !== "boolean"){let coerced132 = undefined;if(!(coerced132 !== undefined)){if(data218 === "false" || data218 === 0 || data218 === null){coerced132 = false;}else if(data218 === "true" || data218 === 1){coerced132 = true;}else {const err279 = {instancePath:instancePath+"/instrumentation/@smithy~1smithy-client/enabled",schemaPath:"instrumentation.js/properties/%40smithy~1smithy-client/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err279];}else {vErrors.push(err279);}errors++;}}if(coerced132 !== undefined){data218 = coerced132;if(data217 !== undefined){data217["enabled"] = coerced132;}}}}}else {const err280 = {instancePath:instancePath+"/instrumentation/@smithy~1smithy-client",schemaPath:"instrumentation.js/properties/%40smithy~1smithy-client/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err280];}else {vErrors.push(err280);}errors++;}}if(data172.amqplib !== undefined){let data219 = data172.amqplib;if(data219 && typeof data219 == "object" && !Array.isArray(data219)){if(data219.enabled !== undefined){let data220 = data219.enabled;if(typeof data220 !== "boolean"){let coerced133 = undefined;if(!(coerced133 !== undefined)){if(data220 === "false" || data220 === 0 || data220 === null){coerced133 = false;}else if(data220 === "true" || data220 === 1){coerced133 = true;}else {const err281 = {instancePath:instancePath+"/instrumentation/amqplib/enabled",schemaPath:"instrumentation.js/properties/amqplib/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err281];}else {vErrors.push(err281);}errors++;}}if(coerced133 !== undefined){data220 = coerced133;if(data219 !== undefined){data219["enabled"] = coerced133;}}}}}else {const err282 = {instancePath:instancePath+"/instrumentation/amqplib",schemaPath:"instrumentation.js/properties/amqplib/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err282];}else {vErrors.push(err282);}errors++;}}if(data172["amqplib/callback_api"] !== undefined){let data221 = data172["amqplib/callback_api"];if(data221 && typeof data221 == "object" && !Array.isArray(data221)){if(data221.enabled !== undefined){let data222 = data221.enabled;if(typeof data222 !== "boolean"){let coerced134 = undefined;if(!(coerced134 !== undefined)){if(data222 === "false" || data222 === 0 || data222 === null){coerced134 = false;}else if(data222 === "true" || data222 === 1){coerced134 = true;}else {const err283 = {instancePath:instancePath+"/instrumentation/amqplib~1callback_api/enabled",schemaPath:"instrumentation.js/properties/amqplib~1callback_api/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err283];}else {vErrors.push(err283);}errors++;}}if(coerced134 !== undefined){data222 = coerced134;if(data221 !== undefined){data221["enabled"] = coerced134;}}}}}else {const err284 = {instancePath:instancePath+"/instrumentation/amqplib~1callback_api",schemaPath:"instrumentation.js/properties/amqplib~1callback_api/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err284];}else {vErrors.push(err284);}errors++;}}if(data172["aws-sdk"] !== undefined){let data223 = data172["aws-sdk"];if(data223 && typeof data223 == "object" && !Array.isArray(data223)){if(data223.enabled !== undefined){let data224 = data223.enabled;if(typeof data224 !== "boolean"){let coerced135 = undefined;if(!(coerced135 !== undefined)){if(data224 === "false" || data224 === 0 || data224 === null){coerced135 = false;}else if(data224 === "true" || data224 === 1){coerced135 = true;}else {const err285 = {instancePath:instancePath+"/instrumentation/aws-sdk/enabled",schemaPath:"instrumentation.js/properties/aws-sdk/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err285];}else {vErrors.push(err285);}errors++;}}if(coerced135 !== undefined){data224 = coerced135;if(data223 !== undefined){data223["enabled"] = coerced135;}}}}}else {const err286 = {instancePath:instancePath+"/instrumentation/aws-sdk",schemaPath:"instrumentation.js/properties/aws-sdk/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err286];}else {vErrors.push(err286);}errors++;}}if(data172.bluebird !== undefined){let data225 = data172.bluebird;if(data225 && typeof data225 == "object" && !Array.isArray(data225)){if(data225.enabled !== undefined){let data226 = data225.enabled;if(typeof data226 !== "boolean"){let coerced136 = undefined;if(!(coerced136 !== undefined)){if(data226 === "false" || data226 === 0 || data226 === null){coerced136 = false;}else if(data226 === "true" || data226 === 1){coerced136 = true;}else {const err287 = {instancePath:instancePath+"/instrumentation/bluebird/enabled",schemaPath:"instrumentation.js/properties/bluebird/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err287];}else {vErrors.push(err287);}errors++;}}if(coerced136 !== undefined){data226 = coerced136;if(data225 !== undefined){data225["enabled"] = coerced136;}}}}}else {const err288 = {instancePath:instancePath+"/instrumentation/bluebird",schemaPath:"instrumentation.js/properties/bluebird/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err288];}else {vErrors.push(err288);}errors++;}}if(data172.bunyan !== undefined){let data227 = data172.bunyan;if(data227 && typeof data227 == "object" && !Array.isArray(data227)){if(data227.enabled !== undefined){let data228 = data227.enabled;if(typeof data228 !== "boolean"){let coerced137 = undefined;if(!(coerced137 !== undefined)){if(data228 === "false" || data228 === 0 || data228 === null){coerced137 = false;}else if(data228 === "true" || data228 === 1){coerced137 = true;}else {const err289 = {instancePath:instancePath+"/instrumentation/bunyan/enabled",schemaPath:"instrumentation.js/properties/bunyan/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err289];}else {vErrors.push(err289);}errors++;}}if(coerced137 !== undefined){data228 = coerced137;if(data227 !== undefined){data227["enabled"] = coerced137;}}}}}else {const err290 = {instancePath:instancePath+"/instrumentation/bunyan",schemaPath:"instrumentation.js/properties/bunyan/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err290];}else {vErrors.push(err290);}errors++;}}if(data172["cassandra-driver"] !== undefined){let data229 = data172["cassandra-driver"];if(data229 && typeof data229 == "object" && !Array.isArray(data229)){if(data229.enabled !== undefined){let data230 = data229.enabled;if(typeof data230 !== "boolean"){let coerced138 = undefined;if(!(coerced138 !== undefined)){if(data230 === "false" || data230 === 0 || data230 === null){coerced138 = false;}else if(data230 === "true" || data230 === 1){coerced138 = true;}else {const err291 = {instancePath:instancePath+"/instrumentation/cassandra-driver/enabled",schemaPath:"instrumentation.js/properties/cassandra-driver/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err291];}else {vErrors.push(err291);}errors++;}}if(coerced138 !== undefined){data230 = coerced138;if(data229 !== undefined){data229["enabled"] = coerced138;}}}}}else {const err292 = {instancePath:instancePath+"/instrumentation/cassandra-driver",schemaPath:"instrumentation.js/properties/cassandra-driver/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err292];}else {vErrors.push(err292);}errors++;}}if(data172.child_process !== undefined){let data231 = data172.child_process;if(data231 && typeof data231 == "object" && !Array.isArray(data231)){if(data231.enabled !== undefined){let data232 = data231.enabled;if(typeof data232 !== "boolean"){let coerced139 = undefined;if(!(coerced139 !== undefined)){if(data232 === "false" || data232 === 0 || data232 === null){coerced139 = false;}else if(data232 === "true" || data232 === 1){coerced139 = true;}else {const err293 = {instancePath:instancePath+"/instrumentation/child_process/enabled",schemaPath:"instrumentation.js/properties/child_process/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err293];}else {vErrors.push(err293);}errors++;}}if(coerced139 !== undefined){data232 = coerced139;if(data231 !== undefined){data231["enabled"] = coerced139;}}}}}else {const err294 = {instancePath:instancePath+"/instrumentation/child_process",schemaPath:"instrumentation.js/properties/child_process/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err294];}else {vErrors.push(err294);}errors++;}}if(data172.connect !== undefined){let data233 = data172.connect;if(data233 && typeof data233 == "object" && !Array.isArray(data233)){if(data233.enabled !== undefined){let data234 = data233.enabled;if(typeof data234 !== "boolean"){let coerced140 = undefined;if(!(coerced140 !== undefined)){if(data234 === "false" || data234 === 0 || data234 === null){coerced140 = false;}else if(data234 === "true" || data234 === 1){coerced140 = true;}else {const err295 = {instancePath:instancePath+"/instrumentation/connect/enabled",schemaPath:"instrumentation.js/properties/connect/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err295];}else {vErrors.push(err295);}errors++;}}if(coerced140 !== undefined){data234 = coerced140;if(data233 !== undefined){data233["enabled"] = coerced140;}}}}}else {const err296 = {instancePath:instancePath+"/instrumentation/connect",schemaPath:"instrumentation.js/properties/connect/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err296];}else {vErrors.push(err296);}errors++;}}if(data172.crypto !== undefined){let data235 = data172.crypto;if(data235 && typeof data235 == "object" && !Array.isArray(data235)){if(data235.enabled !== undefined){let data236 = data235.enabled;if(typeof data236 !== "boolean"){let coerced141 = undefined;if(!(coerced141 !== undefined)){if(data236 === "false" || data236 === 0 || data236 === null){coerced141 = false;}else if(data236 === "true" || data236 === 1){coerced141 = true;}else {const err297 = {instancePath:instancePath+"/instrumentation/crypto/enabled",schemaPath:"instrumentation.js/properties/crypto/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err297];}else {vErrors.push(err297);}errors++;}}if(coerced141 !== undefined){data236 = coerced141;if(data235 !== undefined){data235["enabled"] = coerced141;}}}}}else {const err298 = {instancePath:instancePath+"/instrumentation/crypto",schemaPath:"instrumentation.js/properties/crypto/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err298];}else {vErrors.push(err298);}errors++;}}if(data172.dns !== undefined){let data237 = data172.dns;if(data237 && typeof data237 == "object" && !Array.isArray(data237)){if(data237.enabled !== undefined){let data238 = data237.enabled;if(typeof data238 !== "boolean"){let coerced142 = undefined;if(!(coerced142 !== undefined)){if(data238 === "false" || data238 === 0 || data238 === null){coerced142 = false;}else if(data238 === "true" || data238 === 1){coerced142 = true;}else {const err299 = {instancePath:instancePath+"/instrumentation/dns/enabled",schemaPath:"instrumentation.js/properties/dns/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err299];}else {vErrors.push(err299);}errors++;}}if(coerced142 !== undefined){data238 = coerced142;if(data237 !== undefined){data237["enabled"] = coerced142;}}}}}else {const err300 = {instancePath:instancePath+"/instrumentation/dns",schemaPath:"instrumentation.js/properties/dns/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err300];}else {vErrors.push(err300);}errors++;}}if(data172.express !== undefined){let data239 = data172.express;if(data239 && typeof data239 == "object" && !Array.isArray(data239)){if(data239.enabled !== undefined){let data240 = data239.enabled;if(typeof data240 !== "boolean"){let coerced143 = undefined;if(!(coerced143 !== undefined)){if(data240 === "false" || data240 === 0 || data240 === null){coerced143 = false;}else if(data240 === "true" || data240 === 1){coerced143 = true;}else {const err301 = {instancePath:instancePath+"/instrumentation/express/enabled",schemaPath:"instrumentation.js/properties/express/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err301];}else {vErrors.push(err301);}errors++;}}if(coerced143 !== undefined){data240 = coerced143;if(data239 !== undefined){data239["enabled"] = coerced143;}}}}}else {const err302 = {instancePath:instancePath+"/instrumentation/express",schemaPath:"instrumentation.js/properties/express/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err302];}else {vErrors.push(err302);}errors++;}}if(data172.fastify !== undefined){let data241 = data172.fastify;if(data241 && typeof data241 == "object" && !Array.isArray(data241)){if(data241.enabled !== undefined){let data242 = data241.enabled;if(typeof data242 !== "boolean"){let coerced144 = undefined;if(!(coerced144 !== undefined)){if(data242 === "false" || data242 === 0 || data242 === null){coerced144 = false;}else if(data242 === "true" || data242 === 1){coerced144 = true;}else {const err303 = {instancePath:instancePath+"/instrumentation/fastify/enabled",schemaPath:"instrumentation.js/properties/fastify/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err303];}else {vErrors.push(err303);}errors++;}}if(coerced144 !== undefined){data242 = coerced144;if(data241 !== undefined){data241["enabled"] = coerced144;}}}}}else {const err304 = {instancePath:instancePath+"/instrumentation/fastify",schemaPath:"instrumentation.js/properties/fastify/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err304];}else {vErrors.push(err304);}errors++;}}if(data172.fs !== undefined){let data243 = data172.fs;if(data243 && typeof data243 == "object" && !Array.isArray(data243)){if(data243.enabled !== undefined){let data244 = data243.enabled;if(typeof data244 !== "boolean"){let coerced145 = undefined;if(!(coerced145 !== undefined)){if(data244 === "false" || data244 === 0 || data244 === null){coerced145 = false;}else if(data244 === "true" || data244 === 1){coerced145 = true;}else {const err305 = {instancePath:instancePath+"/instrumentation/fs/enabled",schemaPath:"instrumentation.js/properties/fs/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err305];}else {vErrors.push(err305);}errors++;}}if(coerced145 !== undefined){data244 = coerced145;if(data243 !== undefined){data243["enabled"] = coerced145;}}}}}else {const err306 = {instancePath:instancePath+"/instrumentation/fs",schemaPath:"instrumentation.js/properties/fs/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err306];}else {vErrors.push(err306);}errors++;}}if(data172.http !== undefined){let data245 = data172.http;if(data245 && typeof data245 == "object" && !Array.isArray(data245)){if(data245.enabled !== undefined){let data246 = data245.enabled;if(typeof data246 !== "boolean"){let coerced146 = undefined;if(!(coerced146 !== undefined)){if(data246 === "false" || data246 === 0 || data246 === null){coerced146 = false;}else if(data246 === "true" || data246 === 1){coerced146 = true;}else {const err307 = {instancePath:instancePath+"/instrumentation/http/enabled",schemaPath:"instrumentation.js/properties/http/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err307];}else {vErrors.push(err307);}errors++;}}if(coerced146 !== undefined){data246 = coerced146;if(data245 !== undefined){data245["enabled"] = coerced146;}}}}}else {const err308 = {instancePath:instancePath+"/instrumentation/http",schemaPath:"instrumentation.js/properties/http/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err308];}else {vErrors.push(err308);}errors++;}}if(data172.http2 !== undefined){let data247 = data172.http2;if(data247 && typeof data247 == "object" && !Array.isArray(data247)){if(data247.enabled !== undefined){let data248 = data247.enabled;if(typeof data248 !== "boolean"){let coerced147 = undefined;if(!(coerced147 !== undefined)){if(data248 === "false" || data248 === 0 || data248 === null){coerced147 = false;}else if(data248 === "true" || data248 === 1){coerced147 = true;}else {const err309 = {instancePath:instancePath+"/instrumentation/http2/enabled",schemaPath:"instrumentation.js/properties/http2/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err309];}else {vErrors.push(err309);}errors++;}}if(coerced147 !== undefined){data248 = coerced147;if(data247 !== undefined){data247["enabled"] = coerced147;}}}}}else {const err310 = {instancePath:instancePath+"/instrumentation/http2",schemaPath:"instrumentation.js/properties/http2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err310];}else {vErrors.push(err310);}errors++;}}if(data172.https !== undefined){let data249 = data172.https;if(data249 && typeof data249 == "object" && !Array.isArray(data249)){if(data249.enabled !== undefined){let data250 = data249.enabled;if(typeof data250 !== "boolean"){let coerced148 = undefined;if(!(coerced148 !== undefined)){if(data250 === "false" || data250 === 0 || data250 === null){coerced148 = false;}else if(data250 === "true" || data250 === 1){coerced148 = true;}else {const err311 = {instancePath:instancePath+"/instrumentation/https/enabled",schemaPath:"instrumentation.js/properties/https/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err311];}else {vErrors.push(err311);}errors++;}}if(coerced148 !== undefined){data250 = coerced148;if(data249 !== undefined){data249["enabled"] = coerced148;}}}}}else {const err312 = {instancePath:instancePath+"/instrumentation/https",schemaPath:"instrumentation.js/properties/https/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err312];}else {vErrors.push(err312);}errors++;}}if(data172.ioredis !== undefined){let data251 = data172.ioredis;if(data251 && typeof data251 == "object" && !Array.isArray(data251)){if(data251.enabled !== undefined){let data252 = data251.enabled;if(typeof data252 !== "boolean"){let coerced149 = undefined;if(!(coerced149 !== undefined)){if(data252 === "false" || data252 === 0 || data252 === null){coerced149 = false;}else if(data252 === "true" || data252 === 1){coerced149 = true;}else {const err313 = {instancePath:instancePath+"/instrumentation/ioredis/enabled",schemaPath:"instrumentation.js/properties/ioredis/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err313];}else {vErrors.push(err313);}errors++;}}if(coerced149 !== undefined){data252 = coerced149;if(data251 !== undefined){data251["enabled"] = coerced149;}}}}}else {const err314 = {instancePath:instancePath+"/instrumentation/ioredis",schemaPath:"instrumentation.js/properties/ioredis/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err314];}else {vErrors.push(err314);}errors++;}}if(data172.iovalkey !== undefined){let data253 = data172.iovalkey;if(data253 && typeof data253 == "object" && !Array.isArray(data253)){if(data253.enabled !== undefined){let data254 = data253.enabled;if(typeof data254 !== "boolean"){let coerced150 = undefined;if(!(coerced150 !== undefined)){if(data254 === "false" || data254 === 0 || data254 === null){coerced150 = false;}else if(data254 === "true" || data254 === 1){coerced150 = true;}else {const err315 = {instancePath:instancePath+"/instrumentation/iovalkey/enabled",schemaPath:"instrumentation.js/properties/iovalkey/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err315];}else {vErrors.push(err315);}errors++;}}if(coerced150 !== undefined){data254 = coerced150;if(data253 !== undefined){data253["enabled"] = coerced150;}}}}}else {const err316 = {instancePath:instancePath+"/instrumentation/iovalkey",schemaPath:"instrumentation.js/properties/iovalkey/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err316];}else {vErrors.push(err316);}errors++;}}if(data172.kafkajs !== undefined){let data255 = data172.kafkajs;if(data255 && typeof data255 == "object" && !Array.isArray(data255)){if(data255.enabled !== undefined){let data256 = data255.enabled;if(typeof data256 !== "boolean"){let coerced151 = undefined;if(!(coerced151 !== undefined)){if(data256 === "false" || data256 === 0 || data256 === null){coerced151 = false;}else if(data256 === "true" || data256 === 1){coerced151 = true;}else {const err317 = {instancePath:instancePath+"/instrumentation/kafkajs/enabled",schemaPath:"instrumentation.js/properties/kafkajs/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err317];}else {vErrors.push(err317);}errors++;}}if(coerced151 !== undefined){data256 = coerced151;if(data255 !== undefined){data255["enabled"] = coerced151;}}}}}else {const err318 = {instancePath:instancePath+"/instrumentation/kafkajs",schemaPath:"instrumentation.js/properties/kafkajs/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err318];}else {vErrors.push(err318);}errors++;}}if(data172.koa !== undefined){let data257 = data172.koa;if(data257 && typeof data257 == "object" && !Array.isArray(data257)){if(data257.enabled !== undefined){let data258 = data257.enabled;if(typeof data258 !== "boolean"){let coerced152 = undefined;if(!(coerced152 !== undefined)){if(data258 === "false" || data258 === 0 || data258 === null){coerced152 = false;}else if(data258 === "true" || data258 === 1){coerced152 = true;}else {const err319 = {instancePath:instancePath+"/instrumentation/koa/enabled",schemaPath:"instrumentation.js/properties/koa/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err319];}else {vErrors.push(err319);}errors++;}}if(coerced152 !== undefined){data258 = coerced152;if(data257 !== undefined){data257["enabled"] = coerced152;}}}}}else {const err320 = {instancePath:instancePath+"/instrumentation/koa",schemaPath:"instrumentation.js/properties/koa/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err320];}else {vErrors.push(err320);}errors++;}}if(data172.memcached !== undefined){let data259 = data172.memcached;if(data259 && typeof data259 == "object" && !Array.isArray(data259)){if(data259.enabled !== undefined){let data260 = data259.enabled;if(typeof data260 !== "boolean"){let coerced153 = undefined;if(!(coerced153 !== undefined)){if(data260 === "false" || data260 === 0 || data260 === null){coerced153 = false;}else if(data260 === "true" || data260 === 1){coerced153 = true;}else {const err321 = {instancePath:instancePath+"/instrumentation/memcached/enabled",schemaPath:"instrumentation.js/properties/memcached/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err321];}else {vErrors.push(err321);}errors++;}}if(coerced153 !== undefined){data260 = coerced153;if(data259 !== undefined){data259["enabled"] = coerced153;}}}}}else {const err322 = {instancePath:instancePath+"/instrumentation/memcached",schemaPath:"instrumentation.js/properties/memcached/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err322];}else {vErrors.push(err322);}errors++;}}if(data172.mongodb !== undefined){let data261 = data172.mongodb;if(data261 && typeof data261 == "object" && !Array.isArray(data261)){if(data261.enabled !== undefined){let data262 = data261.enabled;if(typeof data262 !== "boolean"){let coerced154 = undefined;if(!(coerced154 !== undefined)){if(data262 === "false" || data262 === 0 || data262 === null){coerced154 = false;}else if(data262 === "true" || data262 === 1){coerced154 = true;}else {const err323 = {instancePath:instancePath+"/instrumentation/mongodb/enabled",schemaPath:"instrumentation.js/properties/mongodb/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err323];}else {vErrors.push(err323);}errors++;}}if(coerced154 !== undefined){data262 = coerced154;if(data261 !== undefined){data261["enabled"] = coerced154;}}}}}else {const err324 = {instancePath:instancePath+"/instrumentation/mongodb",schemaPath:"instrumentation.js/properties/mongodb/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err324];}else {vErrors.push(err324);}errors++;}}if(data172.mysql !== undefined){let data263 = data172.mysql;if(data263 && typeof data263 == "object" && !Array.isArray(data263)){if(data263.enabled !== undefined){let data264 = data263.enabled;if(typeof data264 !== "boolean"){let coerced155 = undefined;if(!(coerced155 !== undefined)){if(data264 === "false" || data264 === 0 || data264 === null){coerced155 = false;}else if(data264 === "true" || data264 === 1){coerced155 = true;}else {const err325 = {instancePath:instancePath+"/instrumentation/mysql/enabled",schemaPath:"instrumentation.js/properties/mysql/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err325];}else {vErrors.push(err325);}errors++;}}if(coerced155 !== undefined){data264 = coerced155;if(data263 !== undefined){data263["enabled"] = coerced155;}}}}}else {const err326 = {instancePath:instancePath+"/instrumentation/mysql",schemaPath:"instrumentation.js/properties/mysql/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err326];}else {vErrors.push(err326);}errors++;}}if(data172.mysql2 !== undefined){let data265 = data172.mysql2;if(data265 && typeof data265 == "object" && !Array.isArray(data265)){if(data265.enabled !== undefined){let data266 = data265.enabled;if(typeof data266 !== "boolean"){let coerced156 = undefined;if(!(coerced156 !== undefined)){if(data266 === "false" || data266 === 0 || data266 === null){coerced156 = false;}else if(data266 === "true" || data266 === 1){coerced156 = true;}else {const err327 = {instancePath:instancePath+"/instrumentation/mysql2/enabled",schemaPath:"instrumentation.js/properties/mysql2/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err327];}else {vErrors.push(err327);}errors++;}}if(coerced156 !== undefined){data266 = coerced156;if(data265 !== undefined){data265["enabled"] = coerced156;}}}}}else {const err328 = {instancePath:instancePath+"/instrumentation/mysql2",schemaPath:"instrumentation.js/properties/mysql2/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err328];}else {vErrors.push(err328);}errors++;}}if(data172.net !== undefined){let data267 = data172.net;if(data267 && typeof data267 == "object" && !Array.isArray(data267)){if(data267.enabled !== undefined){let data268 = data267.enabled;if(typeof data268 !== "boolean"){let coerced157 = undefined;if(!(coerced157 !== undefined)){if(data268 === "false" || data268 === 0 || data268 === null){coerced157 = false;}else if(data268 === "true" || data268 === 1){coerced157 = true;}else {const err329 = {instancePath:instancePath+"/instrumentation/net/enabled",schemaPath:"instrumentation.js/properties/net/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err329];}else {vErrors.push(err329);}errors++;}}if(coerced157 !== undefined){data268 = coerced157;if(data267 !== undefined){data267["enabled"] = coerced157;}}}}}else {const err330 = {instancePath:instancePath+"/instrumentation/net",schemaPath:"instrumentation.js/properties/net/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err330];}else {vErrors.push(err330);}errors++;}}if(data172.next !== undefined){let data269 = data172.next;if(data269 && typeof data269 == "object" && !Array.isArray(data269)){if(data269.enabled !== undefined){let data270 = data269.enabled;if(typeof data270 !== "boolean"){let coerced158 = undefined;if(!(coerced158 !== undefined)){if(data270 === "false" || data270 === 0 || data270 === null){coerced158 = false;}else if(data270 === "true" || data270 === 1){coerced158 = true;}else {const err331 = {instancePath:instancePath+"/instrumentation/next/enabled",schemaPath:"instrumentation.js/properties/next/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err331];}else {vErrors.push(err331);}errors++;}}if(coerced158 !== undefined){data270 = coerced158;if(data269 !== undefined){data269["enabled"] = coerced158;}}}}}else {const err332 = {instancePath:instancePath+"/instrumentation/next",schemaPath:"instrumentation.js/properties/next/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err332];}else {vErrors.push(err332);}errors++;}}if(data172.openai !== undefined){let data271 = data172.openai;if(data271 && typeof data271 == "object" && !Array.isArray(data271)){if(data271.enabled !== undefined){let data272 = data271.enabled;if(typeof data272 !== "boolean"){let coerced159 = undefined;if(!(coerced159 !== undefined)){if(data272 === "false" || data272 === 0 || data272 === null){coerced159 = false;}else if(data272 === "true" || data272 === 1){coerced159 = true;}else {const err333 = {instancePath:instancePath+"/instrumentation/openai/enabled",schemaPath:"instrumentation.js/properties/openai/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err333];}else {vErrors.push(err333);}errors++;}}if(coerced159 !== undefined){data272 = coerced159;if(data271 !== undefined){data271["enabled"] = coerced159;}}}}}else {const err334 = {instancePath:instancePath+"/instrumentation/openai",schemaPath:"instrumentation.js/properties/openai/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err334];}else {vErrors.push(err334);}errors++;}}if(data172.pg !== undefined){let data273 = data172.pg;if(data273 && typeof data273 == "object" && !Array.isArray(data273)){if(data273.enabled !== undefined){let data274 = data273.enabled;if(typeof data274 !== "boolean"){let coerced160 = undefined;if(!(coerced160 !== undefined)){if(data274 === "false" || data274 === 0 || data274 === null){coerced160 = false;}else if(data274 === "true" || data274 === 1){coerced160 = true;}else {const err335 = {instancePath:instancePath+"/instrumentation/pg/enabled",schemaPath:"instrumentation.js/properties/pg/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err335];}else {vErrors.push(err335);}errors++;}}if(coerced160 !== undefined){data274 = coerced160;if(data273 !== undefined){data273["enabled"] = coerced160;}}}}}else {const err336 = {instancePath:instancePath+"/instrumentation/pg",schemaPath:"instrumentation.js/properties/pg/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err336];}else {vErrors.push(err336);}errors++;}}if(data172.pino !== undefined){let data275 = data172.pino;if(data275 && typeof data275 == "object" && !Array.isArray(data275)){if(data275.enabled !== undefined){let data276 = data275.enabled;if(typeof data276 !== "boolean"){let coerced161 = undefined;if(!(coerced161 !== undefined)){if(data276 === "false" || data276 === 0 || data276 === null){coerced161 = false;}else if(data276 === "true" || data276 === 1){coerced161 = true;}else {const err337 = {instancePath:instancePath+"/instrumentation/pino/enabled",schemaPath:"instrumentation.js/properties/pino/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err337];}else {vErrors.push(err337);}errors++;}}if(coerced161 !== undefined){data276 = coerced161;if(data275 !== undefined){data275["enabled"] = coerced161;}}}}}else {const err338 = {instancePath:instancePath+"/instrumentation/pino",schemaPath:"instrumentation.js/properties/pino/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err338];}else {vErrors.push(err338);}errors++;}}if(data172.q !== undefined){let data277 = data172.q;if(data277 && typeof data277 == "object" && !Array.isArray(data277)){if(data277.enabled !== undefined){let data278 = data277.enabled;if(typeof data278 !== "boolean"){let coerced162 = undefined;if(!(coerced162 !== undefined)){if(data278 === "false" || data278 === 0 || data278 === null){coerced162 = false;}else if(data278 === "true" || data278 === 1){coerced162 = true;}else {const err339 = {instancePath:instancePath+"/instrumentation/q/enabled",schemaPath:"instrumentation.js/properties/q/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err339];}else {vErrors.push(err339);}errors++;}}if(coerced162 !== undefined){data278 = coerced162;if(data277 !== undefined){data277["enabled"] = coerced162;}}}}}else {const err340 = {instancePath:instancePath+"/instrumentation/q",schemaPath:"instrumentation.js/properties/q/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err340];}else {vErrors.push(err340);}errors++;}}if(data172.redis !== undefined){let data279 = data172.redis;if(data279 && typeof data279 == "object" && !Array.isArray(data279)){if(data279.enabled !== undefined){let data280 = data279.enabled;if(typeof data280 !== "boolean"){let coerced163 = undefined;if(!(coerced163 !== undefined)){if(data280 === "false" || data280 === 0 || data280 === null){coerced163 = false;}else if(data280 === "true" || data280 === 1){coerced163 = true;}else {const err341 = {instancePath:instancePath+"/instrumentation/redis/enabled",schemaPath:"instrumentation.js/properties/redis/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err341];}else {vErrors.push(err341);}errors++;}}if(coerced163 !== undefined){data280 = coerced163;if(data279 !== undefined){data279["enabled"] = coerced163;}}}}}else {const err342 = {instancePath:instancePath+"/instrumentation/redis",schemaPath:"instrumentation.js/properties/redis/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err342];}else {vErrors.push(err342);}errors++;}}if(data172.restify !== undefined){let data281 = data172.restify;if(data281 && typeof data281 == "object" && !Array.isArray(data281)){if(data281.enabled !== undefined){let data282 = data281.enabled;if(typeof data282 !== "boolean"){let coerced164 = undefined;if(!(coerced164 !== undefined)){if(data282 === "false" || data282 === 0 || data282 === null){coerced164 = false;}else if(data282 === "true" || data282 === 1){coerced164 = true;}else {const err343 = {instancePath:instancePath+"/instrumentation/restify/enabled",schemaPath:"instrumentation.js/properties/restify/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err343];}else {vErrors.push(err343);}errors++;}}if(coerced164 !== undefined){data282 = coerced164;if(data281 !== undefined){data281["enabled"] = coerced164;}}}}}else {const err344 = {instancePath:instancePath+"/instrumentation/restify",schemaPath:"instrumentation.js/properties/restify/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err344];}else {vErrors.push(err344);}errors++;}}if(data172.router !== undefined){let data283 = data172.router;if(data283 && typeof data283 == "object" && !Array.isArray(data283)){if(data283.enabled !== undefined){let data284 = data283.enabled;if(typeof data284 !== "boolean"){let coerced165 = undefined;if(!(coerced165 !== undefined)){if(data284 === "false" || data284 === 0 || data284 === null){coerced165 = false;}else if(data284 === "true" || data284 === 1){coerced165 = true;}else {const err345 = {instancePath:instancePath+"/instrumentation/router/enabled",schemaPath:"instrumentation.js/properties/router/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err345];}else {vErrors.push(err345);}errors++;}}if(coerced165 !== undefined){data284 = coerced165;if(data283 !== undefined){data283["enabled"] = coerced165;}}}}}else {const err346 = {instancePath:instancePath+"/instrumentation/router",schemaPath:"instrumentation.js/properties/router/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err346];}else {vErrors.push(err346);}errors++;}}if(data172.timers !== undefined){let data285 = data172.timers;if(data285 && typeof data285 == "object" && !Array.isArray(data285)){if(data285.enabled !== undefined){let data286 = data285.enabled;if(typeof data286 !== "boolean"){let coerced166 = undefined;if(!(coerced166 !== undefined)){if(data286 === "false" || data286 === 0 || data286 === null){coerced166 = false;}else if(data286 === "true" || data286 === 1){coerced166 = true;}else {const err347 = {instancePath:instancePath+"/instrumentation/timers/enabled",schemaPath:"instrumentation.js/properties/timers/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err347];}else {vErrors.push(err347);}errors++;}}if(coerced166 !== undefined){data286 = coerced166;if(data285 !== undefined){data285["enabled"] = coerced166;}}}}}else {const err348 = {instancePath:instancePath+"/instrumentation/timers",schemaPath:"instrumentation.js/properties/timers/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err348];}else {vErrors.push(err348);}errors++;}}if(data172.undici !== undefined){let data287 = data172.undici;if(data287 && typeof data287 == "object" && !Array.isArray(data287)){if(data287.enabled !== undefined){let data288 = data287.enabled;if(typeof data288 !== "boolean"){let coerced167 = undefined;if(!(coerced167 !== undefined)){if(data288 === "false" || data288 === 0 || data288 === null){coerced167 = false;}else if(data288 === "true" || data288 === 1){coerced167 = true;}else {const err349 = {instancePath:instancePath+"/instrumentation/undici/enabled",schemaPath:"instrumentation.js/properties/undici/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err349];}else {vErrors.push(err349);}errors++;}}if(coerced167 !== undefined){data288 = coerced167;if(data287 !== undefined){data287["enabled"] = coerced167;}}}}}else {const err350 = {instancePath:instancePath+"/instrumentation/undici",schemaPath:"instrumentation.js/properties/undici/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err350];}else {vErrors.push(err350);}errors++;}}if(data172.when !== undefined){let data289 = data172.when;if(data289 && typeof data289 == "object" && !Array.isArray(data289)){if(data289.enabled !== undefined){let data290 = data289.enabled;if(typeof data290 !== "boolean"){let coerced168 = undefined;if(!(coerced168 !== undefined)){if(data290 === "false" || data290 === 0 || data290 === null){coerced168 = false;}else if(data290 === "true" || data290 === 1){coerced168 = true;}else {const err351 = {instancePath:instancePath+"/instrumentation/when/enabled",schemaPath:"instrumentation.js/properties/when/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err351];}else {vErrors.push(err351);}errors++;}}if(coerced168 !== undefined){data290 = coerced168;if(data289 !== undefined){data289["enabled"] = coerced168;}}}}}else {const err352 = {instancePath:instancePath+"/instrumentation/when",schemaPath:"instrumentation.js/properties/when/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err352];}else {vErrors.push(err352);}errors++;}}if(data172.winston !== undefined){let data291 = data172.winston;if(data291 && typeof data291 == "object" && !Array.isArray(data291)){if(data291.enabled !== undefined){let data292 = data291.enabled;if(typeof data292 !== "boolean"){let coerced169 = undefined;if(!(coerced169 !== undefined)){if(data292 === "false" || data292 === 0 || data292 === null){coerced169 = false;}else if(data292 === "true" || data292 === 1){coerced169 = true;}else {const err353 = {instancePath:instancePath+"/instrumentation/winston/enabled",schemaPath:"instrumentation.js/properties/winston/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err353];}else {vErrors.push(err353);}errors++;}}if(coerced169 !== undefined){data292 = coerced169;if(data291 !== undefined){data291["enabled"] = coerced169;}}}}}else {const err354 = {instancePath:instancePath+"/instrumentation/winston",schemaPath:"instrumentation.js/properties/winston/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err354];}else {vErrors.push(err354);}errors++;}}if(data172.zlib !== undefined){let data293 = data172.zlib;if(data293 && typeof data293 == "object" && !Array.isArray(data293)){if(data293.enabled !== undefined){let data294 = data293.enabled;if(typeof data294 !== "boolean"){let coerced170 = undefined;if(!(coerced170 !== undefined)){if(data294 === "false" || data294 === 0 || data294 === null){coerced170 = false;}else if(data294 === "true" || data294 === 1){coerced170 = true;}else {const err355 = {instancePath:instancePath+"/instrumentation/zlib/enabled",schemaPath:"instrumentation.js/properties/zlib/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err355];}else {vErrors.push(err355);}errors++;}}if(coerced170 !== undefined){data294 = coerced170;if(data293 !== undefined){data293["enabled"] = coerced170;}}}}}else {const err356 = {instancePath:instancePath+"/instrumentation/zlib",schemaPath:"instrumentation.js/properties/zlib/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err356];}else {vErrors.push(err356);}errors++;}}}else {const err357 = {instancePath:instancePath+"/instrumentation",schemaPath:"instrumentation.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err357];}else {vErrors.push(err357);}errors++;}}if(data.kafka !== undefined){let data295 = data.kafka;if(data295 && typeof data295 == "object" && !Array.isArray(data295)){if(data295.metrics !== undefined){let data296 = data295.metrics;if(data296 && typeof data296 == "object" && !Array.isArray(data296)){if(data296.cluster !== undefined){let data297 = data296.cluster;if(data297 && typeof data297 == "object" && !Array.isArray(data297)){if(data297.metrics !== undefined){let data298 = data297.metrics;if(data298 && typeof data298 == "object" && !Array.isArray(data298)){if(data298.enabled !== undefined){let data299 = data298.enabled;if(typeof data299 !== "boolean"){let coerced171 = undefined;if(!(coerced171 !== undefined)){if(data299 === "false" || data299 === 0 || data299 === null){coerced171 = false;}else if(data299 === "true" || data299 === 1){coerced171 = true;}else {const err358 = {instancePath:instancePath+"/kafka/metrics/cluster/metrics/enabled",schemaPath:"kafka.js/properties/metrics/properties/cluster/properties/metrics/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err358];}else {vErrors.push(err358);}errors++;}}if(coerced171 !== undefined){data299 = coerced171;if(data298 !== undefined){data298["enabled"] = coerced171;}}}}}else {const err359 = {instancePath:instancePath+"/kafka/metrics/cluster/metrics",schemaPath:"kafka.js/properties/metrics/properties/cluster/properties/metrics/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err359];}else {vErrors.push(err359);}errors++;}}}else {const err360 = {instancePath:instancePath+"/kafka/metrics/cluster",schemaPath:"kafka.js/properties/metrics/properties/cluster/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err360];}else {vErrors.push(err360);}errors++;}}}else {const err361 = {instancePath:instancePath+"/kafka/metrics",schemaPath:"kafka.js/properties/metrics/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err361];}else {vErrors.push(err361);}errors++;}}}else {const err362 = {instancePath:instancePath+"/kafka",schemaPath:"kafka.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err362];}else {vErrors.push(err362);}errors++;}}if(data.logging !== undefined){let data300 = data.logging;if(data300 && typeof data300 == "object" && !Array.isArray(data300)){if(data300.level !== undefined){let data301 = data300.level;if(typeof data301 !== "string"){let dataType172 = typeof data301;let coerced172 = undefined;if(!(coerced172 !== undefined)){if(dataType172 == "number" || dataType172 == "boolean"){coerced172 = "" + data301;}else if(data301 === null){coerced172 = "";}else {const err363 = {instancePath:instancePath+"/logging/level",schemaPath:"logging.js/properties/level/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err363];}else {vErrors.push(err363);}errors++;}}if(coerced172 !== undefined){data301 = coerced172;if(data300 !== undefined){data300["level"] = coerced172;}}}}if(data300.filepath !== undefined){let data302 = data300.filepath;if(typeof data302 !== "string"){let dataType173 = typeof data302;let coerced173 = undefined;if(!(coerced173 !== undefined)){if(dataType173 == "number" || dataType173 == "boolean"){coerced173 = "" + data302;}else if(data302 === null){coerced173 = "";}else {const err364 = {instancePath:instancePath+"/logging/filepath",schemaPath:"logging.js/properties/filepath/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err364];}else {vErrors.push(err364);}errors++;}}if(coerced173 !== undefined){data302 = coerced173;if(data300 !== undefined){data300["filepath"] = coerced173;}}}}if(data300.enabled !== undefined){let data303 = data300.enabled;if(typeof data303 !== "boolean"){let coerced174 = undefined;if(!(coerced174 !== undefined)){if(data303 === "false" || data303 === 0 || data303 === null){coerced174 = false;}else if(data303 === "true" || data303 === 1){coerced174 = true;}else {const err365 = {instancePath:instancePath+"/logging/enabled",schemaPath:"logging.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err365];}else {vErrors.push(err365);}errors++;}}if(coerced174 !== undefined){data303 = coerced174;if(data300 !== undefined){data300["enabled"] = coerced174;}}}}if(data300.diagnostics !== undefined){let data304 = data300.diagnostics;if(typeof data304 !== "boolean"){let coerced175 = undefined;if(!(coerced175 !== undefined)){if(data304 === "false" || data304 === 0 || data304 === null){coerced175 = false;}else if(data304 === "true" || data304 === 1){coerced175 = true;}else {const err366 = {instancePath:instancePath+"/logging/diagnostics",schemaPath:"logging.js/properties/diagnostics/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err366];}else {vErrors.push(err366);}errors++;}}if(coerced175 !== undefined){data304 = coerced175;if(data300 !== undefined){data300["diagnostics"] = coerced175;}}}}}else {const err367 = {instancePath:instancePath+"/logging",schemaPath:"logging.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err367];}else {vErrors.push(err367);}errors++;}}if(data.message_tracer !== undefined){let data305 = data.message_tracer;if(data305 && typeof data305 == "object" && !Array.isArray(data305)){if(data305.segment_parameters !== undefined){let data306 = data305.segment_parameters;if(data306 && typeof data306 == "object" && !Array.isArray(data306)){if(data306.enabled !== undefined){let data307 = data306.enabled;if(typeof data307 !== "boolean"){let coerced176 = undefined;if(!(coerced176 !== undefined)){if(data307 === "false" || data307 === 0 || data307 === null){coerced176 = false;}else if(data307 === "true" || data307 === 1){coerced176 = true;}else {const err368 = {instancePath:instancePath+"/message_tracer/segment_parameters/enabled",schemaPath:"message-tracer.js/properties/segment_parameters/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err368];}else {vErrors.push(err368);}errors++;}}if(coerced176 !== undefined){data307 = coerced176;if(data306 !== undefined){data306["enabled"] = coerced176;}}}}}else {const err369 = {instancePath:instancePath+"/message_tracer/segment_parameters",schemaPath:"message-tracer.js/properties/segment_parameters/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err369];}else {vErrors.push(err369);}errors++;}}}else {const err370 = {instancePath:instancePath+"/message_tracer",schemaPath:"message-tracer.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err370];}else {vErrors.push(err370);}errors++;}}if(data.opentelemetry !== undefined){let data308 = data.opentelemetry;if(data308 && typeof data308 == "object" && !Array.isArray(data308)){if(data308.enabled !== undefined){let data309 = data308.enabled;if(typeof data309 !== "boolean"){let coerced177 = undefined;if(!(coerced177 !== undefined)){if(data309 === "false" || data309 === 0 || data309 === null){coerced177 = false;}else if(data309 === "true" || data309 === 1){coerced177 = true;}else {const err371 = {instancePath:instancePath+"/opentelemetry/enabled",schemaPath:"opentelemetry.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err371];}else {vErrors.push(err371);}errors++;}}if(coerced177 !== undefined){data309 = coerced177;if(data308 !== undefined){data308["enabled"] = coerced177;}}}}if(data308.traces !== undefined){let data310 = data308.traces;if(data310 && typeof data310 == "object" && !Array.isArray(data310)){if(data310.enabled !== undefined){let data311 = data310.enabled;if(typeof data311 !== "boolean"){let coerced178 = undefined;if(!(coerced178 !== undefined)){if(data311 === "false" || data311 === 0 || data311 === null){coerced178 = false;}else if(data311 === "true" || data311 === 1){coerced178 = true;}else {const err372 = {instancePath:instancePath+"/opentelemetry/traces/enabled",schemaPath:"opentelemetry.js/properties/traces/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err372];}else {vErrors.push(err372);}errors++;}}if(coerced178 !== undefined){data311 = coerced178;if(data310 !== undefined){data310["enabled"] = coerced178;}}}}}else {const err373 = {instancePath:instancePath+"/opentelemetry/traces",schemaPath:"opentelemetry.js/properties/traces/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err373];}else {vErrors.push(err373);}errors++;}}if(data308.logs !== undefined){let data312 = data308.logs;if(data312 && typeof data312 == "object" && !Array.isArray(data312)){if(data312.enabled !== undefined){let data313 = data312.enabled;if(typeof data313 !== "boolean"){let coerced179 = undefined;if(!(coerced179 !== undefined)){if(data313 === "false" || data313 === 0 || data313 === null){coerced179 = false;}else if(data313 === "true" || data313 === 1){coerced179 = true;}else {const err374 = {instancePath:instancePath+"/opentelemetry/logs/enabled",schemaPath:"opentelemetry.js/properties/logs/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err374];}else {vErrors.push(err374);}errors++;}}if(coerced179 !== undefined){data313 = coerced179;if(data312 !== undefined){data312["enabled"] = coerced179;}}}}}else {const err375 = {instancePath:instancePath+"/opentelemetry/logs",schemaPath:"opentelemetry.js/properties/logs/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err375];}else {vErrors.push(err375);}errors++;}}if(data308.metrics !== undefined){let data314 = data308.metrics;if(data314 && typeof data314 == "object" && !Array.isArray(data314)){if(data314.enabled !== undefined){let data315 = data314.enabled;if(typeof data315 !== "boolean"){let coerced180 = undefined;if(!(coerced180 !== undefined)){if(data315 === "false" || data315 === 0 || data315 === null){coerced180 = false;}else if(data315 === "true" || data315 === 1){coerced180 = true;}else {const err376 = {instancePath:instancePath+"/opentelemetry/metrics/enabled",schemaPath:"opentelemetry.js/properties/metrics/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err376];}else {vErrors.push(err376);}errors++;}}if(coerced180 !== undefined){data315 = coerced180;if(data314 !== undefined){data314["enabled"] = coerced180;}}}}if(data314.export_interval !== undefined){let data316 = data314.export_interval;if(!((typeof data316 == "number") && (!(data316 % 1) && !isNaN(data316)))){let dataType181 = typeof data316;let coerced181 = undefined;if(!(coerced181 !== undefined)){if(dataType181 === "boolean" || data316 === null
                  || (dataType181 === "string" && data316 && data316 == +data316 && !(data316 % 1))){coerced181 = +data316;}else {const err377 = {instancePath:instancePath+"/opentelemetry/metrics/export_interval",schemaPath:"opentelemetry.js/properties/metrics/properties/export_interval/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err377];}else {vErrors.push(err377);}errors++;}}if(coerced181 !== undefined){data316 = coerced181;if(data314 !== undefined){data314["export_interval"] = coerced181;}}}}if(data314.export_timeout !== undefined){let data317 = data314.export_timeout;if(!((typeof data317 == "number") && (!(data317 % 1) && !isNaN(data317)))){let dataType182 = typeof data317;let coerced182 = undefined;if(!(coerced182 !== undefined)){if(dataType182 === "boolean" || data317 === null
                  || (dataType182 === "string" && data317 && data317 == +data317 && !(data317 % 1))){coerced182 = +data317;}else {const err378 = {instancePath:instancePath+"/opentelemetry/metrics/export_timeout",schemaPath:"opentelemetry.js/properties/metrics/properties/export_timeout/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err378];}else {vErrors.push(err378);}errors++;}}if(coerced182 !== undefined){data317 = coerced182;if(data314 !== undefined){data314["export_timeout"] = coerced182;}}}}}else {const err379 = {instancePath:instancePath+"/opentelemetry/metrics",schemaPath:"opentelemetry.js/properties/metrics/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err379];}else {vErrors.push(err379);}errors++;}}}else {const err380 = {instancePath:instancePath+"/opentelemetry",schemaPath:"opentelemetry.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err380];}else {vErrors.push(err380);}errors++;}}if(data.plugins !== undefined){let data318 = data.plugins;if(data318 && typeof data318 == "object" && !Array.isArray(data318)){if(data318.native_metrics !== undefined){let data319 = data318.native_metrics;if(data319 && typeof data319 == "object" && !Array.isArray(data319)){if(data319.enabled !== undefined){let data320 = data319.enabled;if(typeof data320 !== "boolean"){let coerced183 = undefined;if(!(coerced183 !== undefined)){if(data320 === "false" || data320 === 0 || data320 === null){coerced183 = false;}else if(data320 === "true" || data320 === 1){coerced183 = true;}else {const err381 = {instancePath:instancePath+"/plugins/native_metrics/enabled",schemaPath:"plugins.js/properties/native_metrics/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err381];}else {vErrors.push(err381);}errors++;}}if(coerced183 !== undefined){data320 = coerced183;if(data319 !== undefined){data319["enabled"] = coerced183;}}}}}else {const err382 = {instancePath:instancePath+"/plugins/native_metrics",schemaPath:"plugins.js/properties/native_metrics/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err382];}else {vErrors.push(err382);}errors++;}}}else {const err383 = {instancePath:instancePath+"/plugins",schemaPath:"plugins.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err383];}else {vErrors.push(err383);}errors++;}}if(data.process_host !== undefined){let data321 = data.process_host;if(data321 && typeof data321 == "object" && !Array.isArray(data321)){if(data321.display_name !== undefined){let data322 = data321.display_name;if(typeof data322 !== "string"){let dataType184 = typeof data322;let coerced184 = undefined;if(!(coerced184 !== undefined)){if(dataType184 == "number" || dataType184 == "boolean"){coerced184 = "" + data322;}else if(data322 === null){coerced184 = "";}else {const err384 = {instancePath:instancePath+"/process_host/display_name",schemaPath:"process-host.js/properties/display_name/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err384];}else {vErrors.push(err384);}errors++;}}if(coerced184 !== undefined){data322 = coerced184;if(data321 !== undefined){data321["display_name"] = coerced184;}}}}if(data321.ipv_preference !== undefined){let data323 = data321.ipv_preference;if(typeof data323 !== "string"){let dataType185 = typeof data323;let coerced185 = undefined;if(!(coerced185 !== undefined)){if(dataType185 == "number" || dataType185 == "boolean"){coerced185 = "" + data323;}else if(data323 === null){coerced185 = "";}else {const err385 = {instancePath:instancePath+"/process_host/ipv_preference",schemaPath:"process-host.js/properties/ipv_preference/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err385];}else {vErrors.push(err385);}errors++;}}if(coerced185 !== undefined){data323 = coerced185;if(data321 !== undefined){data321["ipv_preference"] = coerced185;}}}if(!((data323 === "4") || (data323 === "6"))){const err386 = {instancePath:instancePath+"/process_host/ipv_preference",schemaPath:"process-host.js/properties/ipv_preference/enum",keyword:"enum",params:{allowedValues: schema55.properties.ipv_preference.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err386];}else {vErrors.push(err386);}errors++;}}}else {const err387 = {instancePath:instancePath+"/process_host",schemaPath:"process-host.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err387];}else {vErrors.push(err387);}errors++;}}if(data.profiling !== undefined){let data324 = data.profiling;if(data324 && typeof data324 == "object" && !Array.isArray(data324)){if(data324.enabled !== undefined){let data325 = data324.enabled;if(typeof data325 !== "boolean"){let coerced186 = undefined;if(!(coerced186 !== undefined)){if(data325 === "false" || data325 === 0 || data325 === null){coerced186 = false;}else if(data325 === "true" || data325 === 1){coerced186 = true;}else {const err388 = {instancePath:instancePath+"/profiling/enabled",schemaPath:"profiling.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err388];}else {vErrors.push(err388);}errors++;}}if(coerced186 !== undefined){data325 = coerced186;if(data324 !== undefined){data324["enabled"] = coerced186;}}}}if(data324.include !== undefined){let data326 = data324.include;if(Array.isArray(data326)){const len15 = data326.length;for(let i15=0; i15<len15; i15++){let data327 = data326[i15];if(typeof data327 !== "string"){let dataType187 = typeof data327;let coerced187 = undefined;if(!(coerced187 !== undefined)){if(dataType187 == "number" || dataType187 == "boolean"){coerced187 = "" + data327;}else if(data327 === null){coerced187 = "";}else {const err389 = {instancePath:instancePath+"/profiling/include/" + i15,schemaPath:"profiling.js/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err389];}else {vErrors.push(err389);}errors++;}}if(coerced187 !== undefined){data327 = coerced187;if(data326 !== undefined){data326[i15] = coerced187;}}}}}else {const err390 = {instancePath:instancePath+"/profiling/include",schemaPath:"profiling.js/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err390];}else {vErrors.push(err390);}errors++;}}if(data324.delay !== undefined){let data328 = data324.delay;if(!((typeof data328 == "number") && (!(data328 % 1) && !isNaN(data328)))){let dataType188 = typeof data328;let coerced188 = undefined;if(!(coerced188 !== undefined)){if(dataType188 === "boolean" || data328 === null
                  || (dataType188 === "string" && data328 && data328 == +data328 && !(data328 % 1))){coerced188 = +data328;}else {const err391 = {instancePath:instancePath+"/profiling/delay",schemaPath:"profiling.js/properties/delay/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err391];}else {vErrors.push(err391);}errors++;}}if(coerced188 !== undefined){data328 = coerced188;if(data324 !== undefined){data324["delay"] = coerced188;}}}}if(data324.duration !== undefined){let data329 = data324.duration;if(!((typeof data329 == "number") && (!(data329 % 1) && !isNaN(data329)))){let dataType189 = typeof data329;let coerced189 = undefined;if(!(coerced189 !== undefined)){if(dataType189 === "boolean" || data329 === null
                  || (dataType189 === "string" && data329 && data329 == +data329 && !(data329 % 1))){coerced189 = +data329;}else {const err392 = {instancePath:instancePath+"/profiling/duration",schemaPath:"profiling.js/properties/duration/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err392];}else {vErrors.push(err392);}errors++;}}if(coerced189 !== undefined){data329 = coerced189;if(data324 !== undefined){data324["duration"] = coerced189;}}}}if(data324.source_mapping !== undefined){let data330 = data324.source_mapping;if(data330 && typeof data330 == "object" && !Array.isArray(data330)){if(data330.enabled !== undefined){let data331 = data330.enabled;if(typeof data331 !== "boolean"){let coerced190 = undefined;if(!(coerced190 !== undefined)){if(data331 === "false" || data331 === 0 || data331 === null){coerced190 = false;}else if(data331 === "true" || data331 === 1){coerced190 = true;}else {const err393 = {instancePath:instancePath+"/profiling/source_mapping/enabled",schemaPath:"profiling.js/properties/source_mapping/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err393];}else {vErrors.push(err393);}errors++;}}if(coerced190 !== undefined){data331 = coerced190;if(data330 !== undefined){data330["enabled"] = coerced190;}}}}}else {const err394 = {instancePath:instancePath+"/profiling/source_mapping",schemaPath:"profiling.js/properties/source_mapping/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err394];}else {vErrors.push(err394);}errors++;}}}else {const err395 = {instancePath:instancePath+"/profiling",schemaPath:"profiling.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err395];}else {vErrors.push(err395);}errors++;}}if(data.rules !== undefined){let data332 = data.rules;if(data332 && typeof data332 == "object" && !Array.isArray(data332)){if(data332.name !== undefined){if(!(Array.isArray(data332.name))){const err396 = {instancePath:instancePath+"/rules/name",schemaPath:"rules.js/properties/name/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err396];}else {vErrors.push(err396);}errors++;}}if(data332.ignore !== undefined){let data334 = data332.ignore;if(Array.isArray(data334)){const len16 = data334.length;for(let i16=0; i16<len16; i16++){let data335 = data334[i16];if((typeof data335 !== "string") && (!(data335 && typeof data335 == "object" && !Array.isArray(data335)))){let dataType191 = typeof data335;let coerced191 = undefined;if(!(coerced191 !== undefined)){if(dataType191 == "number" || dataType191 == "boolean"){coerced191 = "" + data335;}else if(data335 === null){coerced191 = "";}else {const err397 = {instancePath:instancePath+"/rules/ignore/" + i16,schemaPath:"rules.js/properties/ignore/items/type",keyword:"type",params:{type: schema57.properties.ignore.items.type},message:"must be string,object"};if(vErrors === null){vErrors = [err397];}else {vErrors.push(err397);}errors++;}}if(coerced191 !== undefined){data335 = coerced191;if(data334 !== undefined){data334[i16] = coerced191;}}}}}else {const err398 = {instancePath:instancePath+"/rules/ignore",schemaPath:"rules.js/properties/ignore/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err398];}else {vErrors.push(err398);}errors++;}}}else {const err399 = {instancePath:instancePath+"/rules",schemaPath:"rules.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err399];}else {vErrors.push(err399);}errors++;}}if(data.security !== undefined){let data336 = data.security;if(data336 && typeof data336 == "object" && !Array.isArray(data336)){if(data336.enabled !== undefined){let data337 = data336.enabled;if(typeof data337 !== "boolean"){let coerced192 = undefined;if(!(coerced192 !== undefined)){if(data337 === "false" || data337 === 0 || data337 === null){coerced192 = false;}else if(data337 === "true" || data337 === 1){coerced192 = true;}else {const err400 = {instancePath:instancePath+"/security/enabled",schemaPath:"security.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err400];}else {vErrors.push(err400);}errors++;}}if(coerced192 !== undefined){data337 = coerced192;if(data336 !== undefined){data336["enabled"] = coerced192;}}}}if(data336.agent !== undefined){let data338 = data336.agent;if(data338 && typeof data338 == "object" && !Array.isArray(data338)){if(data338.enabled !== undefined){let data339 = data338.enabled;if(typeof data339 !== "boolean"){let coerced193 = undefined;if(!(coerced193 !== undefined)){if(data339 === "false" || data339 === 0 || data339 === null){coerced193 = false;}else if(data339 === "true" || data339 === 1){coerced193 = true;}else {const err401 = {instancePath:instancePath+"/security/agent/enabled",schemaPath:"security.js/properties/agent/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err401];}else {vErrors.push(err401);}errors++;}}if(coerced193 !== undefined){data339 = coerced193;if(data338 !== undefined){data338["enabled"] = coerced193;}}}}}else {const err402 = {instancePath:instancePath+"/security/agent",schemaPath:"security.js/properties/agent/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err402];}else {vErrors.push(err402);}errors++;}}if(data336.mode !== undefined){let data340 = data336.mode;if(typeof data340 !== "string"){let dataType194 = typeof data340;let coerced194 = undefined;if(!(coerced194 !== undefined)){if(dataType194 == "number" || dataType194 == "boolean"){coerced194 = "" + data340;}else if(data340 === null){coerced194 = "";}else {const err403 = {instancePath:instancePath+"/security/mode",schemaPath:"security.js/properties/mode/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err403];}else {vErrors.push(err403);}errors++;}}if(coerced194 !== undefined){data340 = coerced194;if(data336 !== undefined){data336["mode"] = coerced194;}}}if(!((data340 === "IAST") || (data340 === "RASP"))){const err404 = {instancePath:instancePath+"/security/mode",schemaPath:"security.js/properties/mode/enum",keyword:"enum",params:{allowedValues: schema58.properties.mode.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err404];}else {vErrors.push(err404);}errors++;}}if(data336.validator_service_url !== undefined){let data341 = data336.validator_service_url;if(typeof data341 !== "string"){let dataType195 = typeof data341;let coerced195 = undefined;if(!(coerced195 !== undefined)){if(dataType195 == "number" || dataType195 == "boolean"){coerced195 = "" + data341;}else if(data341 === null){coerced195 = "";}else {const err405 = {instancePath:instancePath+"/security/validator_service_url",schemaPath:"security.js/properties/validator_service_url/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err405];}else {vErrors.push(err405);}errors++;}}if(coerced195 !== undefined){data341 = coerced195;if(data336 !== undefined){data336["validator_service_url"] = coerced195;}}}}if(data336.detection !== undefined){let data342 = data336.detection;if(data342 && typeof data342 == "object" && !Array.isArray(data342)){if(data342.rci !== undefined){let data343 = data342.rci;if(data343 && typeof data343 == "object" && !Array.isArray(data343)){if(data343.enabled !== undefined){let data344 = data343.enabled;if(typeof data344 !== "boolean"){let coerced196 = undefined;if(!(coerced196 !== undefined)){if(data344 === "false" || data344 === 0 || data344 === null){coerced196 = false;}else if(data344 === "true" || data344 === 1){coerced196 = true;}else {const err406 = {instancePath:instancePath+"/security/detection/rci/enabled",schemaPath:"security.js/properties/detection/properties/rci/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err406];}else {vErrors.push(err406);}errors++;}}if(coerced196 !== undefined){data344 = coerced196;if(data343 !== undefined){data343["enabled"] = coerced196;}}}}}else {const err407 = {instancePath:instancePath+"/security/detection/rci",schemaPath:"security.js/properties/detection/properties/rci/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err407];}else {vErrors.push(err407);}errors++;}}if(data342.rxss !== undefined){let data345 = data342.rxss;if(data345 && typeof data345 == "object" && !Array.isArray(data345)){if(data345.enabled !== undefined){let data346 = data345.enabled;if(typeof data346 !== "boolean"){let coerced197 = undefined;if(!(coerced197 !== undefined)){if(data346 === "false" || data346 === 0 || data346 === null){coerced197 = false;}else if(data346 === "true" || data346 === 1){coerced197 = true;}else {const err408 = {instancePath:instancePath+"/security/detection/rxss/enabled",schemaPath:"security.js/properties/detection/properties/rxss/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err408];}else {vErrors.push(err408);}errors++;}}if(coerced197 !== undefined){data346 = coerced197;if(data345 !== undefined){data345["enabled"] = coerced197;}}}}}else {const err409 = {instancePath:instancePath+"/security/detection/rxss",schemaPath:"security.js/properties/detection/properties/rxss/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err409];}else {vErrors.push(err409);}errors++;}}if(data342.deserialization !== undefined){let data347 = data342.deserialization;if(data347 && typeof data347 == "object" && !Array.isArray(data347)){if(data347.enabled !== undefined){let data348 = data347.enabled;if(typeof data348 !== "boolean"){let coerced198 = undefined;if(!(coerced198 !== undefined)){if(data348 === "false" || data348 === 0 || data348 === null){coerced198 = false;}else if(data348 === "true" || data348 === 1){coerced198 = true;}else {const err410 = {instancePath:instancePath+"/security/detection/deserialization/enabled",schemaPath:"security.js/properties/detection/properties/deserialization/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err410];}else {vErrors.push(err410);}errors++;}}if(coerced198 !== undefined){data348 = coerced198;if(data347 !== undefined){data347["enabled"] = coerced198;}}}}}else {const err411 = {instancePath:instancePath+"/security/detection/deserialization",schemaPath:"security.js/properties/detection/properties/deserialization/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err411];}else {vErrors.push(err411);}errors++;}}}else {const err412 = {instancePath:instancePath+"/security/detection",schemaPath:"security.js/properties/detection/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err412];}else {vErrors.push(err412);}errors++;}}if(data336.iast_test_identifier !== undefined){let data349 = data336.iast_test_identifier;if(typeof data349 !== "string"){let dataType199 = typeof data349;let coerced199 = undefined;if(!(coerced199 !== undefined)){if(dataType199 == "number" || dataType199 == "boolean"){coerced199 = "" + data349;}else if(data349 === null){coerced199 = "";}else {const err413 = {instancePath:instancePath+"/security/iast_test_identifier",schemaPath:"security.js/properties/iast_test_identifier/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err413];}else {vErrors.push(err413);}errors++;}}if(coerced199 !== undefined){data349 = coerced199;if(data336 !== undefined){data336["iast_test_identifier"] = coerced199;}}}}if(data336.scan_controllers !== undefined){let data350 = data336.scan_controllers;if(data350 && typeof data350 == "object" && !Array.isArray(data350)){if(data350.iast_scan_request_rate_limit !== undefined){let data351 = data350.iast_scan_request_rate_limit;if(!((typeof data351 == "number") && (!(data351 % 1) && !isNaN(data351)))){let dataType200 = typeof data351;let coerced200 = undefined;if(!(coerced200 !== undefined)){if(dataType200 === "boolean" || data351 === null
                  || (dataType200 === "string" && data351 && data351 == +data351 && !(data351 % 1))){coerced200 = +data351;}else {const err414 = {instancePath:instancePath+"/security/scan_controllers/iast_scan_request_rate_limit",schemaPath:"security.js/properties/scan_controllers/properties/iast_scan_request_rate_limit/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err414];}else {vErrors.push(err414);}errors++;}}if(coerced200 !== undefined){data351 = coerced200;if(data350 !== undefined){data350["iast_scan_request_rate_limit"] = coerced200;}}}}if(data350.scan_instance_count !== undefined){let data352 = data350.scan_instance_count;if(!((typeof data352 == "number") && (!(data352 % 1) && !isNaN(data352)))){let dataType201 = typeof data352;let coerced201 = undefined;if(!(coerced201 !== undefined)){if(dataType201 === "boolean" || data352 === null
                  || (dataType201 === "string" && data352 && data352 == +data352 && !(data352 % 1))){coerced201 = +data352;}else {const err415 = {instancePath:instancePath+"/security/scan_controllers/scan_instance_count",schemaPath:"security.js/properties/scan_controllers/properties/scan_instance_count/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err415];}else {vErrors.push(err415);}errors++;}}if(coerced201 !== undefined){data352 = coerced201;if(data350 !== undefined){data350["scan_instance_count"] = coerced201;}}}}}else {const err416 = {instancePath:instancePath+"/security/scan_controllers",schemaPath:"security.js/properties/scan_controllers/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err416];}else {vErrors.push(err416);}errors++;}}if(data336.scan_schedule !== undefined){let data353 = data336.scan_schedule;if(data353 && typeof data353 == "object" && !Array.isArray(data353)){if(data353.delay !== undefined){let data354 = data353.delay;if(!((typeof data354 == "number") && (!(data354 % 1) && !isNaN(data354)))){let dataType202 = typeof data354;let coerced202 = undefined;if(!(coerced202 !== undefined)){if(dataType202 === "boolean" || data354 === null
                  || (dataType202 === "string" && data354 && data354 == +data354 && !(data354 % 1))){coerced202 = +data354;}else {const err417 = {instancePath:instancePath+"/security/scan_schedule/delay",schemaPath:"security.js/properties/scan_schedule/properties/delay/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err417];}else {vErrors.push(err417);}errors++;}}if(coerced202 !== undefined){data354 = coerced202;if(data353 !== undefined){data353["delay"] = coerced202;}}}}if(data353.duration !== undefined){let data355 = data353.duration;if(!((typeof data355 == "number") && (!(data355 % 1) && !isNaN(data355)))){let dataType203 = typeof data355;let coerced203 = undefined;if(!(coerced203 !== undefined)){if(dataType203 === "boolean" || data355 === null
                  || (dataType203 === "string" && data355 && data355 == +data355 && !(data355 % 1))){coerced203 = +data355;}else {const err418 = {instancePath:instancePath+"/security/scan_schedule/duration",schemaPath:"security.js/properties/scan_schedule/properties/duration/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err418];}else {vErrors.push(err418);}errors++;}}if(coerced203 !== undefined){data355 = coerced203;if(data353 !== undefined){data353["duration"] = coerced203;}}}}if(data353.schedule !== undefined){let data356 = data353.schedule;if(typeof data356 !== "string"){let dataType204 = typeof data356;let coerced204 = undefined;if(!(coerced204 !== undefined)){if(dataType204 == "number" || dataType204 == "boolean"){coerced204 = "" + data356;}else if(data356 === null){coerced204 = "";}else {const err419 = {instancePath:instancePath+"/security/scan_schedule/schedule",schemaPath:"security.js/properties/scan_schedule/properties/schedule/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err419];}else {vErrors.push(err419);}errors++;}}if(coerced204 !== undefined){data356 = coerced204;if(data353 !== undefined){data353["schedule"] = coerced204;}}}}if(data353.always_sample_traces !== undefined){let data357 = data353.always_sample_traces;if(typeof data357 !== "boolean"){let coerced205 = undefined;if(!(coerced205 !== undefined)){if(data357 === "false" || data357 === 0 || data357 === null){coerced205 = false;}else if(data357 === "true" || data357 === 1){coerced205 = true;}else {const err420 = {instancePath:instancePath+"/security/scan_schedule/always_sample_traces",schemaPath:"security.js/properties/scan_schedule/properties/always_sample_traces/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err420];}else {vErrors.push(err420);}errors++;}}if(coerced205 !== undefined){data357 = coerced205;if(data353 !== undefined){data353["always_sample_traces"] = coerced205;}}}}}else {const err421 = {instancePath:instancePath+"/security/scan_schedule",schemaPath:"security.js/properties/scan_schedule/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err421];}else {vErrors.push(err421);}errors++;}}if(data336.exclude_from_iast_scan !== undefined){let data358 = data336.exclude_from_iast_scan;if(data358 && typeof data358 == "object" && !Array.isArray(data358)){if(data358.api !== undefined){let data359 = data358.api;if(Array.isArray(data359)){const len17 = data359.length;for(let i17=0; i17<len17; i17++){let data360 = data359[i17];if(typeof data360 !== "string"){let dataType206 = typeof data360;let coerced206 = undefined;if(!(coerced206 !== undefined)){if(dataType206 == "number" || dataType206 == "boolean"){coerced206 = "" + data360;}else if(data360 === null){coerced206 = "";}else {const err422 = {instancePath:instancePath+"/security/exclude_from_iast_scan/api/" + i17,schemaPath:"security.js/properties/exclude_from_iast_scan/properties/api/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err422];}else {vErrors.push(err422);}errors++;}}if(coerced206 !== undefined){data360 = coerced206;if(data359 !== undefined){data359[i17] = coerced206;}}}}}else {const err423 = {instancePath:instancePath+"/security/exclude_from_iast_scan/api",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/api/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err423];}else {vErrors.push(err423);}errors++;}}if(data358.http_request_parameters !== undefined){let data361 = data358.http_request_parameters;if(data361 && typeof data361 == "object" && !Array.isArray(data361)){if(data361.header !== undefined){let data362 = data361.header;if(Array.isArray(data362)){const len18 = data362.length;for(let i18=0; i18<len18; i18++){let data363 = data362[i18];if(typeof data363 !== "string"){let dataType207 = typeof data363;let coerced207 = undefined;if(!(coerced207 !== undefined)){if(dataType207 == "number" || dataType207 == "boolean"){coerced207 = "" + data363;}else if(data363 === null){coerced207 = "";}else {const err424 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/header/" + i18,schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/header/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err424];}else {vErrors.push(err424);}errors++;}}if(coerced207 !== undefined){data363 = coerced207;if(data362 !== undefined){data362[i18] = coerced207;}}}}}else {const err425 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/header",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/header/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err425];}else {vErrors.push(err425);}errors++;}}if(data361.query !== undefined){let data364 = data361.query;if(Array.isArray(data364)){const len19 = data364.length;for(let i19=0; i19<len19; i19++){let data365 = data364[i19];if(typeof data365 !== "string"){let dataType208 = typeof data365;let coerced208 = undefined;if(!(coerced208 !== undefined)){if(dataType208 == "number" || dataType208 == "boolean"){coerced208 = "" + data365;}else if(data365 === null){coerced208 = "";}else {const err426 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/query/" + i19,schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/query/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err426];}else {vErrors.push(err426);}errors++;}}if(coerced208 !== undefined){data365 = coerced208;if(data364 !== undefined){data364[i19] = coerced208;}}}}}else {const err427 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/query",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/query/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err427];}else {vErrors.push(err427);}errors++;}}if(data361.body !== undefined){let data366 = data361.body;if(Array.isArray(data366)){const len20 = data366.length;for(let i20=0; i20<len20; i20++){let data367 = data366[i20];if(typeof data367 !== "string"){let dataType209 = typeof data367;let coerced209 = undefined;if(!(coerced209 !== undefined)){if(dataType209 == "number" || dataType209 == "boolean"){coerced209 = "" + data367;}else if(data367 === null){coerced209 = "";}else {const err428 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/body/" + i20,schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/body/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err428];}else {vErrors.push(err428);}errors++;}}if(coerced209 !== undefined){data367 = coerced209;if(data366 !== undefined){data366[i20] = coerced209;}}}}}else {const err429 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters/body",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/properties/body/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err429];}else {vErrors.push(err429);}errors++;}}}else {const err430 = {instancePath:instancePath+"/security/exclude_from_iast_scan/http_request_parameters",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/http_request_parameters/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err430];}else {vErrors.push(err430);}errors++;}}if(data358.iast_detection_category !== undefined){let data368 = data358.iast_detection_category;if(data368 && typeof data368 == "object" && !Array.isArray(data368)){if(data368.insecure_settings !== undefined){let data369 = data368.insecure_settings;if(typeof data369 !== "boolean"){let coerced210 = undefined;if(!(coerced210 !== undefined)){if(data369 === "false" || data369 === 0 || data369 === null){coerced210 = false;}else if(data369 === "true" || data369 === 1){coerced210 = true;}else {const err431 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/insecure_settings",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/insecure_settings/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err431];}else {vErrors.push(err431);}errors++;}}if(coerced210 !== undefined){data369 = coerced210;if(data368 !== undefined){data368["insecure_settings"] = coerced210;}}}}if(data368.invalid_file_access !== undefined){let data370 = data368.invalid_file_access;if(typeof data370 !== "boolean"){let coerced211 = undefined;if(!(coerced211 !== undefined)){if(data370 === "false" || data370 === 0 || data370 === null){coerced211 = false;}else if(data370 === "true" || data370 === 1){coerced211 = true;}else {const err432 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/invalid_file_access",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/invalid_file_access/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err432];}else {vErrors.push(err432);}errors++;}}if(coerced211 !== undefined){data370 = coerced211;if(data368 !== undefined){data368["invalid_file_access"] = coerced211;}}}}if(data368.sql_injection !== undefined){let data371 = data368.sql_injection;if(typeof data371 !== "boolean"){let coerced212 = undefined;if(!(coerced212 !== undefined)){if(data371 === "false" || data371 === 0 || data371 === null){coerced212 = false;}else if(data371 === "true" || data371 === 1){coerced212 = true;}else {const err433 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/sql_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/sql_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err433];}else {vErrors.push(err433);}errors++;}}if(coerced212 !== undefined){data371 = coerced212;if(data368 !== undefined){data368["sql_injection"] = coerced212;}}}}if(data368.nosql_injection !== undefined){let data372 = data368.nosql_injection;if(typeof data372 !== "boolean"){let coerced213 = undefined;if(!(coerced213 !== undefined)){if(data372 === "false" || data372 === 0 || data372 === null){coerced213 = false;}else if(data372 === "true" || data372 === 1){coerced213 = true;}else {const err434 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/nosql_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/nosql_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err434];}else {vErrors.push(err434);}errors++;}}if(coerced213 !== undefined){data372 = coerced213;if(data368 !== undefined){data368["nosql_injection"] = coerced213;}}}}if(data368.ldap_injection !== undefined){let data373 = data368.ldap_injection;if(typeof data373 !== "boolean"){let coerced214 = undefined;if(!(coerced214 !== undefined)){if(data373 === "false" || data373 === 0 || data373 === null){coerced214 = false;}else if(data373 === "true" || data373 === 1){coerced214 = true;}else {const err435 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/ldap_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/ldap_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err435];}else {vErrors.push(err435);}errors++;}}if(coerced214 !== undefined){data373 = coerced214;if(data368 !== undefined){data368["ldap_injection"] = coerced214;}}}}if(data368.javascript_injection !== undefined){let data374 = data368.javascript_injection;if(typeof data374 !== "boolean"){let coerced215 = undefined;if(!(coerced215 !== undefined)){if(data374 === "false" || data374 === 0 || data374 === null){coerced215 = false;}else if(data374 === "true" || data374 === 1){coerced215 = true;}else {const err436 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/javascript_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/javascript_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err436];}else {vErrors.push(err436);}errors++;}}if(coerced215 !== undefined){data374 = coerced215;if(data368 !== undefined){data368["javascript_injection"] = coerced215;}}}}if(data368.command_injection !== undefined){let data375 = data368.command_injection;if(typeof data375 !== "boolean"){let coerced216 = undefined;if(!(coerced216 !== undefined)){if(data375 === "false" || data375 === 0 || data375 === null){coerced216 = false;}else if(data375 === "true" || data375 === 1){coerced216 = true;}else {const err437 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/command_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/command_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err437];}else {vErrors.push(err437);}errors++;}}if(coerced216 !== undefined){data375 = coerced216;if(data368 !== undefined){data368["command_injection"] = coerced216;}}}}if(data368.xpath_injection !== undefined){let data376 = data368.xpath_injection;if(typeof data376 !== "boolean"){let coerced217 = undefined;if(!(coerced217 !== undefined)){if(data376 === "false" || data376 === 0 || data376 === null){coerced217 = false;}else if(data376 === "true" || data376 === 1){coerced217 = true;}else {const err438 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/xpath_injection",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/xpath_injection/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err438];}else {vErrors.push(err438);}errors++;}}if(coerced217 !== undefined){data376 = coerced217;if(data368 !== undefined){data368["xpath_injection"] = coerced217;}}}}if(data368.ssrf !== undefined){let data377 = data368.ssrf;if(typeof data377 !== "boolean"){let coerced218 = undefined;if(!(coerced218 !== undefined)){if(data377 === "false" || data377 === 0 || data377 === null){coerced218 = false;}else if(data377 === "true" || data377 === 1){coerced218 = true;}else {const err439 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/ssrf",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/ssrf/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err439];}else {vErrors.push(err439);}errors++;}}if(coerced218 !== undefined){data377 = coerced218;if(data368 !== undefined){data368["ssrf"] = coerced218;}}}}if(data368.rxss !== undefined){let data378 = data368.rxss;if(typeof data378 !== "boolean"){let coerced219 = undefined;if(!(coerced219 !== undefined)){if(data378 === "false" || data378 === 0 || data378 === null){coerced219 = false;}else if(data378 === "true" || data378 === 1){coerced219 = true;}else {const err440 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category/rxss",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/properties/rxss/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err440];}else {vErrors.push(err440);}errors++;}}if(coerced219 !== undefined){data378 = coerced219;if(data368 !== undefined){data368["rxss"] = coerced219;}}}}}else {const err441 = {instancePath:instancePath+"/security/exclude_from_iast_scan/iast_detection_category",schemaPath:"security.js/properties/exclude_from_iast_scan/properties/iast_detection_category/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err441];}else {vErrors.push(err441);}errors++;}}}else {const err442 = {instancePath:instancePath+"/security/exclude_from_iast_scan",schemaPath:"security.js/properties/exclude_from_iast_scan/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err442];}else {vErrors.push(err442);}errors++;}}}else {const err443 = {instancePath:instancePath+"/security",schemaPath:"security.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err443];}else {vErrors.push(err443);}errors++;}}if(data.serverless_mode !== undefined){let data379 = data.serverless_mode;if(data379 && typeof data379 == "object" && !Array.isArray(data379)){if(data379.enabled !== undefined){let data380 = data379.enabled;if(typeof data380 !== "boolean"){let coerced220 = undefined;if(!(coerced220 !== undefined)){if(data380 === "false" || data380 === 0 || data380 === null){coerced220 = false;}else if(data380 === "true" || data380 === 1){coerced220 = true;}else {const err444 = {instancePath:instancePath+"/serverless_mode/enabled",schemaPath:"serverless-mode.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err444];}else {vErrors.push(err444);}errors++;}}if(coerced220 !== undefined){data380 = coerced220;if(data379 !== undefined){data379["enabled"] = coerced220;}}}}}else {const err445 = {instancePath:instancePath+"/serverless_mode",schemaPath:"serverless-mode.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err445];}else {vErrors.push(err445);}errors++;}}if(data.slow_sql !== undefined){let data381 = data.slow_sql;if(data381 && typeof data381 == "object" && !Array.isArray(data381)){if(data381.enabled !== undefined){let data382 = data381.enabled;if(typeof data382 !== "boolean"){let coerced221 = undefined;if(!(coerced221 !== undefined)){if(data382 === "false" || data382 === 0 || data382 === null){coerced221 = false;}else if(data382 === "true" || data382 === 1){coerced221 = true;}else {const err446 = {instancePath:instancePath+"/slow_sql/enabled",schemaPath:"slow-sql.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err446];}else {vErrors.push(err446);}errors++;}}if(coerced221 !== undefined){data382 = coerced221;if(data381 !== undefined){data381["enabled"] = coerced221;}}}}if(data381.max_samples !== undefined){let data383 = data381.max_samples;if(!((typeof data383 == "number") && (!(data383 % 1) && !isNaN(data383)))){let dataType222 = typeof data383;let coerced222 = undefined;if(!(coerced222 !== undefined)){if(dataType222 === "boolean" || data383 === null
                  || (dataType222 === "string" && data383 && data383 == +data383 && !(data383 % 1))){coerced222 = +data383;}else {const err447 = {instancePath:instancePath+"/slow_sql/max_samples",schemaPath:"slow-sql.js/properties/max_samples/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err447];}else {vErrors.push(err447);}errors++;}}if(coerced222 !== undefined){data383 = coerced222;if(data381 !== undefined){data381["max_samples"] = coerced222;}}}}}else {const err448 = {instancePath:instancePath+"/slow_sql",schemaPath:"slow-sql.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err448];}else {vErrors.push(err448);}errors++;}}if(data.span_events !== undefined){let data384 = data.span_events;if(data384 && typeof data384 == "object" && !Array.isArray(data384)){if(data384.enabled !== undefined){let data385 = data384.enabled;if(typeof data385 !== "boolean"){let coerced223 = undefined;if(!(coerced223 !== undefined)){if(data385 === "false" || data385 === 0 || data385 === null){coerced223 = false;}else if(data385 === "true" || data385 === 1){coerced223 = true;}else {const err449 = {instancePath:instancePath+"/span_events/enabled",schemaPath:"span-events.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err449];}else {vErrors.push(err449);}errors++;}}if(coerced223 !== undefined){data385 = coerced223;if(data384 !== undefined){data384["enabled"] = coerced223;}}}}if(data384.attributes !== undefined){let data386 = data384.attributes;if(data386 && typeof data386 == "object" && !Array.isArray(data386)){if(data386.enabled !== undefined){let data387 = data386.enabled;if(typeof data387 !== "boolean"){let coerced224 = undefined;if(!(coerced224 !== undefined)){if(data387 === "false" || data387 === 0 || data387 === null){coerced224 = false;}else if(data387 === "true" || data387 === 1){coerced224 = true;}else {const err450 = {instancePath:instancePath+"/span_events/attributes/enabled",schemaPath:"span-events.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err450];}else {vErrors.push(err450);}errors++;}}if(coerced224 !== undefined){data387 = coerced224;if(data386 !== undefined){data386["enabled"] = coerced224;}}}}if(data386.exclude !== undefined){let data388 = data386.exclude;if(Array.isArray(data388)){const len21 = data388.length;for(let i21=0; i21<len21; i21++){let data389 = data388[i21];if(typeof data389 !== "string"){let dataType225 = typeof data389;let coerced225 = undefined;if(!(coerced225 !== undefined)){if(dataType225 == "number" || dataType225 == "boolean"){coerced225 = "" + data389;}else if(data389 === null){coerced225 = "";}else {const err451 = {instancePath:instancePath+"/span_events/attributes/exclude/" + i21,schemaPath:"span-events.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err451];}else {vErrors.push(err451);}errors++;}}if(coerced225 !== undefined){data389 = coerced225;if(data388 !== undefined){data388[i21] = coerced225;}}}}}else {const err452 = {instancePath:instancePath+"/span_events/attributes/exclude",schemaPath:"span-events.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err452];}else {vErrors.push(err452);}errors++;}}if(data386.include !== undefined){let data390 = data386.include;if(Array.isArray(data390)){const len22 = data390.length;for(let i22=0; i22<len22; i22++){let data391 = data390[i22];if(typeof data391 !== "string"){let dataType226 = typeof data391;let coerced226 = undefined;if(!(coerced226 !== undefined)){if(dataType226 == "number" || dataType226 == "boolean"){coerced226 = "" + data391;}else if(data391 === null){coerced226 = "";}else {const err453 = {instancePath:instancePath+"/span_events/attributes/include/" + i22,schemaPath:"span-events.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err453];}else {vErrors.push(err453);}errors++;}}if(coerced226 !== undefined){data391 = coerced226;if(data390 !== undefined){data390[i22] = coerced226;}}}}}else {const err454 = {instancePath:instancePath+"/span_events/attributes/include",schemaPath:"span-events.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err454];}else {vErrors.push(err454);}errors++;}}}else {const err455 = {instancePath:instancePath+"/span_events/attributes",schemaPath:"span-events.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err455];}else {vErrors.push(err455);}errors++;}}if(data384.max_samples_stored !== undefined){let data392 = data384.max_samples_stored;if(!((typeof data392 == "number") && (!(data392 % 1) && !isNaN(data392)))){let dataType227 = typeof data392;let coerced227 = undefined;if(!(coerced227 !== undefined)){if(dataType227 === "boolean" || data392 === null
                  || (dataType227 === "string" && data392 && data392 == +data392 && !(data392 % 1))){coerced227 = +data392;}else {const err456 = {instancePath:instancePath+"/span_events/max_samples_stored",schemaPath:"span-events.js/properties/max_samples_stored/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err456];}else {vErrors.push(err456);}errors++;}}if(coerced227 !== undefined){data392 = coerced227;if(data384 !== undefined){data384["max_samples_stored"] = coerced227;}}}}}else {const err457 = {instancePath:instancePath+"/span_events",schemaPath:"span-events.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err457];}else {vErrors.push(err457);}errors++;}}if(data.strip_exception_messages !== undefined){let data393 = data.strip_exception_messages;if(data393 && typeof data393 == "object" && !Array.isArray(data393)){if(data393.enabled !== undefined){let data394 = data393.enabled;if(typeof data394 !== "boolean"){let coerced228 = undefined;if(!(coerced228 !== undefined)){if(data394 === "false" || data394 === 0 || data394 === null){coerced228 = false;}else if(data394 === "true" || data394 === 1){coerced228 = true;}else {const err458 = {instancePath:instancePath+"/strip_exception_messages/enabled",schemaPath:"strip-exception-messages.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err458];}else {vErrors.push(err458);}errors++;}}if(coerced228 !== undefined){data394 = coerced228;if(data393 !== undefined){data393["enabled"] = coerced228;}}}}}else {const err459 = {instancePath:instancePath+"/strip_exception_messages",schemaPath:"strip-exception-messages.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err459];}else {vErrors.push(err459);}errors++;}}if(data.transaction_events !== undefined){let data395 = data.transaction_events;if(data395 && typeof data395 == "object" && !Array.isArray(data395)){if(data395.attributes !== undefined){let data396 = data395.attributes;if(data396 && typeof data396 == "object" && !Array.isArray(data396)){if(data396.enabled !== undefined){let data397 = data396.enabled;if(typeof data397 !== "boolean"){let coerced229 = undefined;if(!(coerced229 !== undefined)){if(data397 === "false" || data397 === 0 || data397 === null){coerced229 = false;}else if(data397 === "true" || data397 === 1){coerced229 = true;}else {const err460 = {instancePath:instancePath+"/transaction_events/attributes/enabled",schemaPath:"transaction-events.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err460];}else {vErrors.push(err460);}errors++;}}if(coerced229 !== undefined){data397 = coerced229;if(data396 !== undefined){data396["enabled"] = coerced229;}}}}if(data396.exclude !== undefined){let data398 = data396.exclude;if(Array.isArray(data398)){const len23 = data398.length;for(let i23=0; i23<len23; i23++){let data399 = data398[i23];if(typeof data399 !== "string"){let dataType230 = typeof data399;let coerced230 = undefined;if(!(coerced230 !== undefined)){if(dataType230 == "number" || dataType230 == "boolean"){coerced230 = "" + data399;}else if(data399 === null){coerced230 = "";}else {const err461 = {instancePath:instancePath+"/transaction_events/attributes/exclude/" + i23,schemaPath:"transaction-events.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err461];}else {vErrors.push(err461);}errors++;}}if(coerced230 !== undefined){data399 = coerced230;if(data398 !== undefined){data398[i23] = coerced230;}}}}}else {const err462 = {instancePath:instancePath+"/transaction_events/attributes/exclude",schemaPath:"transaction-events.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err462];}else {vErrors.push(err462);}errors++;}}if(data396.include !== undefined){let data400 = data396.include;if(Array.isArray(data400)){const len24 = data400.length;for(let i24=0; i24<len24; i24++){let data401 = data400[i24];if(typeof data401 !== "string"){let dataType231 = typeof data401;let coerced231 = undefined;if(!(coerced231 !== undefined)){if(dataType231 == "number" || dataType231 == "boolean"){coerced231 = "" + data401;}else if(data401 === null){coerced231 = "";}else {const err463 = {instancePath:instancePath+"/transaction_events/attributes/include/" + i24,schemaPath:"transaction-events.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err463];}else {vErrors.push(err463);}errors++;}}if(coerced231 !== undefined){data401 = coerced231;if(data400 !== undefined){data400[i24] = coerced231;}}}}}else {const err464 = {instancePath:instancePath+"/transaction_events/attributes/include",schemaPath:"transaction-events.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err464];}else {vErrors.push(err464);}errors++;}}}else {const err465 = {instancePath:instancePath+"/transaction_events/attributes",schemaPath:"transaction-events.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err465];}else {vErrors.push(err465);}errors++;}}if(data395.enabled !== undefined){let data402 = data395.enabled;if(typeof data402 !== "boolean"){let coerced232 = undefined;if(!(coerced232 !== undefined)){if(data402 === "false" || data402 === 0 || data402 === null){coerced232 = false;}else if(data402 === "true" || data402 === 1){coerced232 = true;}else {const err466 = {instancePath:instancePath+"/transaction_events/enabled",schemaPath:"transaction-events.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err466];}else {vErrors.push(err466);}errors++;}}if(coerced232 !== undefined){data402 = coerced232;if(data395 !== undefined){data395["enabled"] = coerced232;}}}}if(data395.max_samples_stored !== undefined){let data403 = data395.max_samples_stored;if(!((typeof data403 == "number") && (!(data403 % 1) && !isNaN(data403)))){let dataType233 = typeof data403;let coerced233 = undefined;if(!(coerced233 !== undefined)){if(dataType233 === "boolean" || data403 === null
                  || (dataType233 === "string" && data403 && data403 == +data403 && !(data403 % 1))){coerced233 = +data403;}else {const err467 = {instancePath:instancePath+"/transaction_events/max_samples_stored",schemaPath:"transaction-events.js/properties/max_samples_stored/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err467];}else {vErrors.push(err467);}errors++;}}if(coerced233 !== undefined){data403 = coerced233;if(data395 !== undefined){data395["max_samples_stored"] = coerced233;}}}}}else {const err468 = {instancePath:instancePath+"/transaction_events",schemaPath:"transaction-events.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err468];}else {vErrors.push(err468);}errors++;}}if(data.transaction_segments !== undefined){let data404 = data.transaction_segments;if(data404 && typeof data404 == "object" && !Array.isArray(data404)){if(data404.attributes !== undefined){let data405 = data404.attributes;if(data405 && typeof data405 == "object" && !Array.isArray(data405)){if(data405.enabled !== undefined){let data406 = data405.enabled;if(typeof data406 !== "boolean"){let coerced234 = undefined;if(!(coerced234 !== undefined)){if(data406 === "false" || data406 === 0 || data406 === null){coerced234 = false;}else if(data406 === "true" || data406 === 1){coerced234 = true;}else {const err469 = {instancePath:instancePath+"/transaction_segments/attributes/enabled",schemaPath:"transaction-segments.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err469];}else {vErrors.push(err469);}errors++;}}if(coerced234 !== undefined){data406 = coerced234;if(data405 !== undefined){data405["enabled"] = coerced234;}}}}if(data405.exclude !== undefined){let data407 = data405.exclude;if(Array.isArray(data407)){const len25 = data407.length;for(let i25=0; i25<len25; i25++){let data408 = data407[i25];if(typeof data408 !== "string"){let dataType235 = typeof data408;let coerced235 = undefined;if(!(coerced235 !== undefined)){if(dataType235 == "number" || dataType235 == "boolean"){coerced235 = "" + data408;}else if(data408 === null){coerced235 = "";}else {const err470 = {instancePath:instancePath+"/transaction_segments/attributes/exclude/" + i25,schemaPath:"transaction-segments.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err470];}else {vErrors.push(err470);}errors++;}}if(coerced235 !== undefined){data408 = coerced235;if(data407 !== undefined){data407[i25] = coerced235;}}}}}else {const err471 = {instancePath:instancePath+"/transaction_segments/attributes/exclude",schemaPath:"transaction-segments.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err471];}else {vErrors.push(err471);}errors++;}}if(data405.include !== undefined){let data409 = data405.include;if(Array.isArray(data409)){const len26 = data409.length;for(let i26=0; i26<len26; i26++){let data410 = data409[i26];if(typeof data410 !== "string"){let dataType236 = typeof data410;let coerced236 = undefined;if(!(coerced236 !== undefined)){if(dataType236 == "number" || dataType236 == "boolean"){coerced236 = "" + data410;}else if(data410 === null){coerced236 = "";}else {const err472 = {instancePath:instancePath+"/transaction_segments/attributes/include/" + i26,schemaPath:"transaction-segments.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err472];}else {vErrors.push(err472);}errors++;}}if(coerced236 !== undefined){data410 = coerced236;if(data409 !== undefined){data409[i26] = coerced236;}}}}}else {const err473 = {instancePath:instancePath+"/transaction_segments/attributes/include",schemaPath:"transaction-segments.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err473];}else {vErrors.push(err473);}errors++;}}}else {const err474 = {instancePath:instancePath+"/transaction_segments/attributes",schemaPath:"transaction-segments.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err474];}else {vErrors.push(err474);}errors++;}}}else {const err475 = {instancePath:instancePath+"/transaction_segments",schemaPath:"transaction-segments.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err475];}else {vErrors.push(err475);}errors++;}}if(data.transaction_tracer !== undefined){let data411 = data.transaction_tracer;if(data411 && typeof data411 == "object" && !Array.isArray(data411)){if(data411.attributes !== undefined){let data412 = data411.attributes;if(data412 && typeof data412 == "object" && !Array.isArray(data412)){if(data412.enabled !== undefined){let data413 = data412.enabled;if(typeof data413 !== "boolean"){let coerced237 = undefined;if(!(coerced237 !== undefined)){if(data413 === "false" || data413 === 0 || data413 === null){coerced237 = false;}else if(data413 === "true" || data413 === 1){coerced237 = true;}else {const err476 = {instancePath:instancePath+"/transaction_tracer/attributes/enabled",schemaPath:"transaction-tracer.js/properties/attributes/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err476];}else {vErrors.push(err476);}errors++;}}if(coerced237 !== undefined){data413 = coerced237;if(data412 !== undefined){data412["enabled"] = coerced237;}}}}if(data412.exclude !== undefined){let data414 = data412.exclude;if(Array.isArray(data414)){const len27 = data414.length;for(let i27=0; i27<len27; i27++){let data415 = data414[i27];if(typeof data415 !== "string"){let dataType238 = typeof data415;let coerced238 = undefined;if(!(coerced238 !== undefined)){if(dataType238 == "number" || dataType238 == "boolean"){coerced238 = "" + data415;}else if(data415 === null){coerced238 = "";}else {const err477 = {instancePath:instancePath+"/transaction_tracer/attributes/exclude/" + i27,schemaPath:"transaction-tracer.js/properties/attributes/properties/exclude/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err477];}else {vErrors.push(err477);}errors++;}}if(coerced238 !== undefined){data415 = coerced238;if(data414 !== undefined){data414[i27] = coerced238;}}}}}else {const err478 = {instancePath:instancePath+"/transaction_tracer/attributes/exclude",schemaPath:"transaction-tracer.js/properties/attributes/properties/exclude/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err478];}else {vErrors.push(err478);}errors++;}}if(data412.include !== undefined){let data416 = data412.include;if(Array.isArray(data416)){const len28 = data416.length;for(let i28=0; i28<len28; i28++){let data417 = data416[i28];if(typeof data417 !== "string"){let dataType239 = typeof data417;let coerced239 = undefined;if(!(coerced239 !== undefined)){if(dataType239 == "number" || dataType239 == "boolean"){coerced239 = "" + data417;}else if(data417 === null){coerced239 = "";}else {const err479 = {instancePath:instancePath+"/transaction_tracer/attributes/include/" + i28,schemaPath:"transaction-tracer.js/properties/attributes/properties/include/items/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err479];}else {vErrors.push(err479);}errors++;}}if(coerced239 !== undefined){data417 = coerced239;if(data416 !== undefined){data416[i28] = coerced239;}}}}}else {const err480 = {instancePath:instancePath+"/transaction_tracer/attributes/include",schemaPath:"transaction-tracer.js/properties/attributes/properties/include/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err480];}else {vErrors.push(err480);}errors++;}}}else {const err481 = {instancePath:instancePath+"/transaction_tracer/attributes",schemaPath:"transaction-tracer.js/properties/attributes/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err481];}else {vErrors.push(err481);}errors++;}}if(data411.enabled !== undefined){let data418 = data411.enabled;if(typeof data418 !== "boolean"){let coerced240 = undefined;if(!(coerced240 !== undefined)){if(data418 === "false" || data418 === 0 || data418 === null){coerced240 = false;}else if(data418 === "true" || data418 === 1){coerced240 = true;}else {const err482 = {instancePath:instancePath+"/transaction_tracer/enabled",schemaPath:"transaction-tracer.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err482];}else {vErrors.push(err482);}errors++;}}if(coerced240 !== undefined){data418 = coerced240;if(data411 !== undefined){data411["enabled"] = coerced240;}}}}if(data411.transaction_threshold !== undefined){let data419 = data411.transaction_threshold;if((!(typeof data419 == "number")) && (typeof data419 !== "string")){let dataType241 = typeof data419;let coerced241 = undefined;if(!(coerced241 !== undefined)){if(dataType241 == "boolean" || data419 === null
                  || (dataType241 == "string" && data419 && data419 == +data419)){coerced241 = +data419;}else if(dataType241 == "number" || dataType241 == "boolean"){coerced241 = "" + data419;}else if(data419 === null){coerced241 = "";}else {const err483 = {instancePath:instancePath+"/transaction_tracer/transaction_threshold",schemaPath:"transaction-tracer.js/properties/transaction_threshold/type",keyword:"type",params:{type: schema65.properties.transaction_threshold.type},message:"must be number,string"};if(vErrors === null){vErrors = [err483];}else {vErrors.push(err483);}errors++;}}if(coerced241 !== undefined){data419 = coerced241;if(data411 !== undefined){data411["transaction_threshold"] = coerced241;}}}}if(data411.top_n !== undefined){let data420 = data411.top_n;if(!((typeof data420 == "number") && (!(data420 % 1) && !isNaN(data420)))){let dataType242 = typeof data420;let coerced242 = undefined;if(!(coerced242 !== undefined)){if(dataType242 === "boolean" || data420 === null
                  || (dataType242 === "string" && data420 && data420 == +data420 && !(data420 % 1))){coerced242 = +data420;}else {const err484 = {instancePath:instancePath+"/transaction_tracer/top_n",schemaPath:"transaction-tracer.js/properties/top_n/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err484];}else {vErrors.push(err484);}errors++;}}if(coerced242 !== undefined){data420 = coerced242;if(data411 !== undefined){data411["top_n"] = coerced242;}}}}if(data411.record_sql !== undefined){let data421 = data411.record_sql;if(typeof data421 !== "string"){let dataType243 = typeof data421;let coerced243 = undefined;if(!(coerced243 !== undefined)){if(dataType243 == "number" || dataType243 == "boolean"){coerced243 = "" + data421;}else if(data421 === null){coerced243 = "";}else {const err485 = {instancePath:instancePath+"/transaction_tracer/record_sql",schemaPath:"transaction-tracer.js/properties/record_sql/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err485];}else {vErrors.push(err485);}errors++;}}if(coerced243 !== undefined){data421 = coerced243;if(data411 !== undefined){data411["record_sql"] = coerced243;}}}if(!(((data421 === "off") || (data421 === "obfuscated")) || (data421 === "raw"))){const err486 = {instancePath:instancePath+"/transaction_tracer/record_sql",schemaPath:"transaction-tracer.js/properties/record_sql/enum",keyword:"enum",params:{allowedValues: schema65.properties.record_sql.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err486];}else {vErrors.push(err486);}errors++;}}if(data411.explain_threshold !== undefined){let data422 = data411.explain_threshold;if(!((typeof data422 == "number") && (!(data422 % 1) && !isNaN(data422)))){let dataType244 = typeof data422;let coerced244 = undefined;if(!(coerced244 !== undefined)){if(dataType244 === "boolean" || data422 === null
                  || (dataType244 === "string" && data422 && data422 == +data422 && !(data422 % 1))){coerced244 = +data422;}else {const err487 = {instancePath:instancePath+"/transaction_tracer/explain_threshold",schemaPath:"transaction-tracer.js/properties/explain_threshold/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err487];}else {vErrors.push(err487);}errors++;}}if(coerced244 !== undefined){data422 = coerced244;if(data411 !== undefined){data411["explain_threshold"] = coerced244;}}}}}else {const err488 = {instancePath:instancePath+"/transaction_tracer",schemaPath:"transaction-tracer.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err488];}else {vErrors.push(err488);}errors++;}}if(data.url_obfuscation !== undefined){let data423 = data.url_obfuscation;if(data423 && typeof data423 == "object" && !Array.isArray(data423)){if(data423.enabled !== undefined){let data424 = data423.enabled;if(typeof data424 !== "boolean"){let coerced245 = undefined;if(!(coerced245 !== undefined)){if(data424 === "false" || data424 === 0 || data424 === null){coerced245 = false;}else if(data424 === "true" || data424 === 1){coerced245 = true;}else {const err489 = {instancePath:instancePath+"/url_obfuscation/enabled",schemaPath:"url-obfuscation.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err489];}else {vErrors.push(err489);}errors++;}}if(coerced245 !== undefined){data424 = coerced245;if(data423 !== undefined){data423["enabled"] = coerced245;}}}}if(data423.regex !== undefined){let data425 = data423.regex;if(data425 && typeof data425 == "object" && !Array.isArray(data425)){if(data425.pattern !== undefined){let data426 = data425.pattern;if(typeof data426 !== "string"){let dataType246 = typeof data426;let coerced246 = undefined;if(!(coerced246 !== undefined)){if(dataType246 == "number" || dataType246 == "boolean"){coerced246 = "" + data426;}else if(data426 === null){coerced246 = "";}else {const err490 = {instancePath:instancePath+"/url_obfuscation/regex/pattern",schemaPath:"url-obfuscation.js/properties/regex/properties/pattern/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err490];}else {vErrors.push(err490);}errors++;}}if(coerced246 !== undefined){data426 = coerced246;if(data425 !== undefined){data425["pattern"] = coerced246;}}}}if(data425.flags !== undefined){let data427 = data425.flags;if(typeof data427 !== "string"){let dataType247 = typeof data427;let coerced247 = undefined;if(!(coerced247 !== undefined)){if(dataType247 == "number" || dataType247 == "boolean"){coerced247 = "" + data427;}else if(data427 === null){coerced247 = "";}else {const err491 = {instancePath:instancePath+"/url_obfuscation/regex/flags",schemaPath:"url-obfuscation.js/properties/regex/properties/flags/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err491];}else {vErrors.push(err491);}errors++;}}if(coerced247 !== undefined){data427 = coerced247;if(data425 !== undefined){data425["flags"] = coerced247;}}}}if(data425.replacement !== undefined){let data428 = data425.replacement;if(typeof data428 !== "string"){let dataType248 = typeof data428;let coerced248 = undefined;if(!(coerced248 !== undefined)){if(dataType248 == "number" || dataType248 == "boolean"){coerced248 = "" + data428;}else if(data428 === null){coerced248 = "";}else {const err492 = {instancePath:instancePath+"/url_obfuscation/regex/replacement",schemaPath:"url-obfuscation.js/properties/regex/properties/replacement/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err492];}else {vErrors.push(err492);}errors++;}}if(coerced248 !== undefined){data428 = coerced248;if(data425 !== undefined){data425["replacement"] = coerced248;}}}}}else {const err493 = {instancePath:instancePath+"/url_obfuscation/regex",schemaPath:"url-obfuscation.js/properties/regex/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err493];}else {vErrors.push(err493);}errors++;}}}else {const err494 = {instancePath:instancePath+"/url_obfuscation",schemaPath:"url-obfuscation.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err494];}else {vErrors.push(err494);}errors++;}}if(data.utilization !== undefined){let data429 = data.utilization;if(data429 && typeof data429 == "object" && !Array.isArray(data429)){if(data429.detect_aws !== undefined){let data430 = data429.detect_aws;if(typeof data430 !== "boolean"){let coerced249 = undefined;if(!(coerced249 !== undefined)){if(data430 === "false" || data430 === 0 || data430 === null){coerced249 = false;}else if(data430 === "true" || data430 === 1){coerced249 = true;}else {const err495 = {instancePath:instancePath+"/utilization/detect_aws",schemaPath:"utilization.js/properties/detect_aws/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err495];}else {vErrors.push(err495);}errors++;}}if(coerced249 !== undefined){data430 = coerced249;if(data429 !== undefined){data429["detect_aws"] = coerced249;}}}}if(data429.detect_pcf !== undefined){let data431 = data429.detect_pcf;if(typeof data431 !== "boolean"){let coerced250 = undefined;if(!(coerced250 !== undefined)){if(data431 === "false" || data431 === 0 || data431 === null){coerced250 = false;}else if(data431 === "true" || data431 === 1){coerced250 = true;}else {const err496 = {instancePath:instancePath+"/utilization/detect_pcf",schemaPath:"utilization.js/properties/detect_pcf/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err496];}else {vErrors.push(err496);}errors++;}}if(coerced250 !== undefined){data431 = coerced250;if(data429 !== undefined){data429["detect_pcf"] = coerced250;}}}}if(data429.detect_azure !== undefined){let data432 = data429.detect_azure;if(typeof data432 !== "boolean"){let coerced251 = undefined;if(!(coerced251 !== undefined)){if(data432 === "false" || data432 === 0 || data432 === null){coerced251 = false;}else if(data432 === "true" || data432 === 1){coerced251 = true;}else {const err497 = {instancePath:instancePath+"/utilization/detect_azure",schemaPath:"utilization.js/properties/detect_azure/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err497];}else {vErrors.push(err497);}errors++;}}if(coerced251 !== undefined){data432 = coerced251;if(data429 !== undefined){data429["detect_azure"] = coerced251;}}}}if(data429.detect_azurefunction !== undefined){let data433 = data429.detect_azurefunction;if(typeof data433 !== "boolean"){let coerced252 = undefined;if(!(coerced252 !== undefined)){if(data433 === "false" || data433 === 0 || data433 === null){coerced252 = false;}else if(data433 === "true" || data433 === 1){coerced252 = true;}else {const err498 = {instancePath:instancePath+"/utilization/detect_azurefunction",schemaPath:"utilization.js/properties/detect_azurefunction/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err498];}else {vErrors.push(err498);}errors++;}}if(coerced252 !== undefined){data433 = coerced252;if(data429 !== undefined){data429["detect_azurefunction"] = coerced252;}}}}if(data429.detect_docker !== undefined){let data434 = data429.detect_docker;if(typeof data434 !== "boolean"){let coerced253 = undefined;if(!(coerced253 !== undefined)){if(data434 === "false" || data434 === 0 || data434 === null){coerced253 = false;}else if(data434 === "true" || data434 === 1){coerced253 = true;}else {const err499 = {instancePath:instancePath+"/utilization/detect_docker",schemaPath:"utilization.js/properties/detect_docker/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err499];}else {vErrors.push(err499);}errors++;}}if(coerced253 !== undefined){data434 = coerced253;if(data429 !== undefined){data429["detect_docker"] = coerced253;}}}}if(data429.detect_gcp !== undefined){let data435 = data429.detect_gcp;if(typeof data435 !== "boolean"){let coerced254 = undefined;if(!(coerced254 !== undefined)){if(data435 === "false" || data435 === 0 || data435 === null){coerced254 = false;}else if(data435 === "true" || data435 === 1){coerced254 = true;}else {const err500 = {instancePath:instancePath+"/utilization/detect_gcp",schemaPath:"utilization.js/properties/detect_gcp/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err500];}else {vErrors.push(err500);}errors++;}}if(coerced254 !== undefined){data435 = coerced254;if(data429 !== undefined){data429["detect_gcp"] = coerced254;}}}}if(data429.detect_kubernetes !== undefined){let data436 = data429.detect_kubernetes;if(typeof data436 !== "boolean"){let coerced255 = undefined;if(!(coerced255 !== undefined)){if(data436 === "false" || data436 === 0 || data436 === null){coerced255 = false;}else if(data436 === "true" || data436 === 1){coerced255 = true;}else {const err501 = {instancePath:instancePath+"/utilization/detect_kubernetes",schemaPath:"utilization.js/properties/detect_kubernetes/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err501];}else {vErrors.push(err501);}errors++;}}if(coerced255 !== undefined){data436 = coerced255;if(data429 !== undefined){data429["detect_kubernetes"] = coerced255;}}}}if(data429.logical_processors !== undefined){let data437 = data429.logical_processors;if(!(typeof data437 == "number")){let dataType256 = typeof data437;let coerced256 = undefined;if(!(coerced256 !== undefined)){if(dataType256 == "boolean" || data437 === null
                  || (dataType256 == "string" && data437 && data437 == +data437)){coerced256 = +data437;}else {const err502 = {instancePath:instancePath+"/utilization/logical_processors",schemaPath:"utilization.js/properties/logical_processors/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err502];}else {vErrors.push(err502);}errors++;}}if(coerced256 !== undefined){data437 = coerced256;if(data429 !== undefined){data429["logical_processors"] = coerced256;}}}}if(data429.billing_hostname !== undefined){let data438 = data429.billing_hostname;if((typeof data438 !== "string") && (data438 !== null)){let dataType257 = typeof data438;let coerced257 = undefined;if(!(coerced257 !== undefined)){if(dataType257 == "number" || dataType257 == "boolean"){coerced257 = "" + data438;}else if(data438 === null){coerced257 = "";}else if(data438 === "" || data438 === 0 || data438 === false){coerced257 = null;}else {const err503 = {instancePath:instancePath+"/utilization/billing_hostname",schemaPath:"utilization.js/properties/billing_hostname/type",keyword:"type",params:{type: schema67.properties.billing_hostname.type},message:"must be string,null"};if(vErrors === null){vErrors = [err503];}else {vErrors.push(err503);}errors++;}}if(coerced257 !== undefined){data438 = coerced257;if(data429 !== undefined){data429["billing_hostname"] = coerced257;}}}}if(data429.total_ram_mib !== undefined){let data439 = data429.total_ram_mib;if(!((typeof data439 == "number") && (!(data439 % 1) && !isNaN(data439)))){let dataType258 = typeof data439;let coerced258 = undefined;if(!(coerced258 !== undefined)){if(dataType258 === "boolean" || data439 === null
                  || (dataType258 === "string" && data439 && data439 == +data439 && !(data439 % 1))){coerced258 = +data439;}else {const err504 = {instancePath:instancePath+"/utilization/total_ram_mib",schemaPath:"utilization.js/properties/total_ram_mib/type",keyword:"type",params:{type: "integer"},message:"must be integer"};if(vErrors === null){vErrors = [err504];}else {vErrors.push(err504);}errors++;}}if(coerced258 !== undefined){data439 = coerced258;if(data429 !== undefined){data429["total_ram_mib"] = coerced258;}}}}if(data429.gcp_use_instance_as_host !== undefined){let data440 = data429.gcp_use_instance_as_host;if(typeof data440 !== "boolean"){let coerced259 = undefined;if(!(coerced259 !== undefined)){if(data440 === "false" || data440 === 0 || data440 === null){coerced259 = false;}else if(data440 === "true" || data440 === 1){coerced259 = true;}else {const err505 = {instancePath:instancePath+"/utilization/gcp_use_instance_as_host",schemaPath:"utilization.js/properties/gcp_use_instance_as_host/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err505];}else {vErrors.push(err505);}errors++;}}if(coerced259 !== undefined){data440 = coerced259;if(data429 !== undefined){data429["gcp_use_instance_as_host"] = coerced259;}}}}if(data429.gcp_cloud_run !== undefined){let data441 = data429.gcp_cloud_run;if(data441 && typeof data441 == "object" && !Array.isArray(data441)){if(data441.include_revision_in_host !== undefined){let data442 = data441.include_revision_in_host;if(typeof data442 !== "boolean"){let coerced260 = undefined;if(!(coerced260 !== undefined)){if(data442 === "false" || data442 === 0 || data442 === null){coerced260 = false;}else if(data442 === "true" || data442 === 1){coerced260 = true;}else {const err506 = {instancePath:instancePath+"/utilization/gcp_cloud_run/include_revision_in_host",schemaPath:"utilization.js/properties/gcp_cloud_run/properties/include_revision_in_host/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err506];}else {vErrors.push(err506);}errors++;}}if(coerced260 !== undefined){data442 = coerced260;if(data441 !== undefined){data441["include_revision_in_host"] = coerced260;}}}}if(data441.use_instance_as_host !== undefined){let data443 = data441.use_instance_as_host;if(typeof data443 !== "boolean"){let coerced261 = undefined;if(!(coerced261 !== undefined)){if(data443 === "false" || data443 === 0 || data443 === null){coerced261 = false;}else if(data443 === "true" || data443 === 1){coerced261 = true;}else {const err507 = {instancePath:instancePath+"/utilization/gcp_cloud_run/use_instance_as_host",schemaPath:"utilization.js/properties/gcp_cloud_run/properties/use_instance_as_host/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err507];}else {vErrors.push(err507);}errors++;}}if(coerced261 !== undefined){data443 = coerced261;if(data441 !== undefined){data441["use_instance_as_host"] = coerced261;}}}}}else {const err508 = {instancePath:instancePath+"/utilization/gcp_cloud_run",schemaPath:"utilization.js/properties/gcp_cloud_run/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err508];}else {vErrors.push(err508);}errors++;}}}else {const err509 = {instancePath:instancePath+"/utilization",schemaPath:"utilization.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err509];}else {vErrors.push(err509);}errors++;}}if(data.worker_threads !== undefined){let data444 = data.worker_threads;if(data444 && typeof data444 == "object" && !Array.isArray(data444)){if(data444.enabled !== undefined){let data445 = data444.enabled;if(typeof data445 !== "boolean"){let coerced262 = undefined;if(!(coerced262 !== undefined)){if(data445 === "false" || data445 === 0 || data445 === null){coerced262 = false;}else if(data445 === "true" || data445 === 1){coerced262 = true;}else {const err510 = {instancePath:instancePath+"/worker_threads/enabled",schemaPath:"worker-threads.js/properties/enabled/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};if(vErrors === null){vErrors = [err510];}else {vErrors.push(err510);}errors++;}}if(coerced262 !== undefined){data445 = coerced262;if(data444 !== undefined){data444["enabled"] = coerced262;}}}}}else {const err511 = {instancePath:instancePath+"/worker_threads",schemaPath:"worker-threads.js/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err511];}else {vErrors.push(err511);}errors++;}}}else {const err512 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err512];}else {vErrors.push(err512);}errors++;}validate20.errors = vErrors;return errors === 0;}validate20.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

  })(module, exports, require)
  return module.exports
})()

module.exports = { schema, validate, refs, renderedSchema, envVarIndex }