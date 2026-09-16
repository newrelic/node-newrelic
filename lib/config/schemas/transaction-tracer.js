/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'transaction-tracer.js',
  type: 'object',
  properties: {
    attributes: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'If `true`, the agent captures attributes from transaction traces.'
        },
        exclude: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to exclude from transaction traces. Allows * as wildcard at end.'
        },
        include: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to include in transaction traces. Allows * as wildcard at end.'
        }
      },
      additionalProperties: true
    },
    enabled: {
      'x-newrelic-env-var': 'NEW_RELIC_TRACER_ENABLED',
      type: 'boolean',
      default: true,
      description: "Whether to collect & submit slow transaction traces to New Relic. The instrumentation is loaded regardless of this setting, as it's necessary to gather metrics. Disable the agent to prevent the instrumentation from loading."
    },
    transaction_threshold: {
      'x-newrelic-env-var': 'NEW_RELIC_TRACER_THRESHOLD',
      type: [
        'number',
        'string'
      ],
      default: 'apdex_f',
      description: "Sets the time, in seconds, for a transaction to be considered slow. When a transaction exceeds this threshold, a transaction trace will be recorded. When set to 'apdex_f', the threshold will be set to 4 * apdex_t, which with a default apdex_t value of 500 milliseconds will be 2 seconds. If a number is provided, it is set in seconds."
    },
    top_n: {
      'x-newrelic-env-var': 'NEW_RELIC_TRACER_TOP_N',
      type: 'integer',
      default: 20,
      description: 'Increase this parameter to increase the diversity of the slow transaction traces recorded by your application over time. Confused? Read on. Transactions are named based on the request (see the README for the details of how requests are mapped to transactions), and top_n refers to the "top n slowest transactions" grouped by these names. The module will only replace a recorded trace with a new trace if the new trace is slower than the previous slowest trace of that name. The default value for this setting is 20, as the transaction trace view page also defaults to showing the 20 slowest transactions. If you want to record the absolute slowest transaction over the last minute, set top_n to 0 or 1. This used to be the default, and has a problem in that it will allow one very slow route to dominate your slow transaction traces. The module will always record at least 5 different slow transactions in the reporting periods after it starts up, and will reset its internal slow trace aggregator if no slow transactions have been recorded for the last 5 harvest cycles, restarting the aggregation process. env NEW_RELIC_TRACER_TOP_N'
    },
    record_sql: {
      'x-newrelic-env-var': 'NEW_RELIC_RECORD_SQL',
      type: 'string',
      enum: [
        'off',
        'obfuscated',
        'raw'
      ],
      default: 'obfuscated',
      description: "This option affects both slow-queries and record_sql for transaction traces. It can have one of 3 values: 'off', 'obfuscated' or 'raw' When it is 'off' no slow queries will be captured, and backtraces and sql will not be included in transaction traces. If it is 'raw' or 'obfuscated' and other criteria (slow_sql.enabled etc) are met for a query. The raw or obfuscated sql will be included in the transaction trace and a slow query sample will be collected."
    },
    explain_threshold: {
      'x-newrelic-env-var': 'NEW_RELIC_EXPLAIN_THRESHOLD',
      type: 'integer',
      default: 500,
      description: 'This option affects both slow-queries and record_sql for transaction traces. This is the minimum duration a query must take (in ms) for it to be considered for for slow query and inclusion in transaction traces.'
    }
  },
  additionalProperties: true
}
