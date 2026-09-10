/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'distributed-tracing.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Enables/disables distributed tracing.'
    },
    exclude_newrelic_header: {
      type: 'boolean',
      default: true,
      description: 'Excludes New Relic format distributed tracing header (`newrelic`) on outbound requests when set to `true`. By default (when false) both W3C TraceContext (`traceparent`, `tracecontext`) and New Relic formats will be sent.'
    },
    sampler: {
      type: 'object',
      properties: {
        root: {
          type: 'string',
          enum: [
            'trace_id_ratio_based',
            'adaptive',
            'always_on',
            'always_off'
          ],
          default: 'adaptive',
          description: "Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"
        },
        remote_parent_sampled: {
          type: 'string',
          enum: [
            'trace_id_ratio_based',
            'adaptive',
            'always_on',
            'always_off'
          ],
          default: 'adaptive',
          description: 'When set to `always_on`, the sampled flag in the `traceparent` header being set to "true" will result in the local transaction being sampled with a priority value of "2". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting.'
        },
        remote_parent_not_sampled: {
          type: 'string',
          enum: [
            'trace_id_ratio_based',
            'adaptive',
            'always_on',
            'always_off'
          ],
          default: 'adaptive',
          description: 'When set to `always_on`, the local transaction will be sampled with a priority of "2". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0.'
        },
        adaptive_sampling_target: {
          type: 'integer',
          default: 10,
          minimum: 1,
          maximum: 120,
          description: "The sampling target for adaptive sampling is controlled via this attribute when configuring the default/adaptive sampler. The default sampling target is 10 transactions/min when it is not specified but **MUST** be within the range of [1, 120] (inclusive). Upon agent connect, the connect response **MUST** provide the value of `sampling_target` based on this configuration setting's value. The `sampling_target` value from the connect response **SHOULD** be used as the sampling target value for adaptive sampling in the agent."
        },
        full_granularity: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              default: true
            }
          },
          additionalProperties: true
        },
        partial_granularity: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              default: false
            },
            type: {
              type: 'string',
              enum: [
                'compact',
                'essential',
                'reduced'
              ],
              default: 'essential'
            },
            root: {
              type: 'string',
              enum: [
                'trace_id_ratio_based',
                'adaptive',
                'always_on',
                'always_off'
              ],
              default: 'adaptive',
              description: "Example setting root sampler via config to a string value - root: 'always_on' Example setting root sampler via config to trace id ratio based - root: { trace_id_ratio_based: { ratio: 0.5 } }"
            },
            remote_parent_sampled: {
              type: 'string',
              enum: [
                'trace_id_ratio_based',
                'adaptive',
                'always_on',
                'always_off'
              ],
              default: 'adaptive',
              description: 'When set to `always_on`, the sampled flag in the `traceparent` header being set to "true" will result in the local transaction being sampled with a priority value of "2". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting takes precedence over the `remote_parent_not_sampled` setting.'
            },
            remote_parent_not_sampled: {
              type: 'string',
              enum: [
                'trace_id_ratio_based',
                'adaptive',
                'always_on',
                'always_off'
              ],
              default: 'adaptive',
              description: 'When set to `always_on`, the local transaction will be sampled with a priority of "2". When set to `always_off`, the local transaction will never be sampled. At the default setting, the sampling decision will be determined according to the normal algorithm. This setting only affects decisions when the traceparent sampled flag is set to 0.'
            }
          },
          additionalProperties: true
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Controls the method of cross agent tracing in the agent. Distributed tracing lets you see the path that a request takes through your distributed system. Enabling distributed tracing changes the behavior of some New Relic features, so carefully consult the transition guide before you enable this feature: https://docs.newrelic.com/docs/transition-guide-distributed-tracing Default is true.'
}
