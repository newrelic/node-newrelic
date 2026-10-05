/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'opentelemetry.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Global switch for the whole OpenTelemetry feature. If it is set to `false`, any other sub-feature, e.g. `traces`, will not be enabled regardless of that specific sub-feature setting.'
    },
    traces: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: true,
      description: '`traces` are instrumentations, e.g. `@fastify/otel`. Enabling `traces` enables bridging OpenTelemetry instrumentations into the New Relic agent.'
    },
    logs: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: true,
      description: '`logs` governs automatic configuration of the OpenTelemetry logs API. When true, the agent will automatically configure the logs API to send logs emitted through the OTEL specific API to New Relic. This feature is dependent on application logs forwarding. Thus, application logs forwarding must be enabled as well.'
    },
    metrics: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true
        },
        export_interval: {
          type: 'integer',
          default: 60000,
          description: '`export_interval` defines the number of milliseconds between each attempt to ship metrics to New Relic. This value must be equal to or greater than the value of `export_timeout`.'
        },
        export_timeout: {
          type: 'integer',
          default: 10000,
          description: '`export_timeout` defines the number of milliseconds an export operation is allowed in order to successfully complete. If the timeout is exceeded, it will be reported via the OpenTelemetry diagnostics API.'
        }
      },
      additionalProperties: true,
      description: '`metrics` governs automatic configuration of the OpenTelemetry metrics API. When `true`, the agent will automatically configure the metrics API to send metrics to New Relic and attach them to the application entity that is instrumented by the New Relic agent.'
    }
  },
  additionalProperties: true,
  description: 'Governs the various OpenTelemetry based features provided by the agent. NOTICE: this configuration is subject to change while the OTEL feature set is in development.'
}
